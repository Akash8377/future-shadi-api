const pool = require('../config/db')
const bcrypt = require("bcryptjs");
const { onlineUsers, lastSeenMap } = require('./../utils/onlineTracker');

class Matches {
    static async getMyMatches(user_id, lookingFor, filters = {}, partnerPrefs = null) {
    try {
        if (!partnerPrefs || Object.keys(partnerPrefs).length === 0) {
        return [];
        }
    
        let baseQuery = `
        SELECT u.id AS user_id,
       u.profileId,
       u.first_name,
       u.last_name,
       u.email,
       u.looking_for,
       u.dob,
       u.religion,
       u.education,
       u.country,
       u.online_status,
       p.*,
       CASE 
           WHEN n.id IS NOT NULL 
                AND n.sender_user_id = ? 
                AND n.receiver_user_id = u.id 
                AND n.status IN ('pending', 'accepted') 
           THEN true 
           WHEN n2.id IS NOT NULL
                AND n2.receiver_user_id = ?
                AND n2.sender_user_id = u.id
                AND n2.status IN ('pending', 'accepted')
           THEN true
           ELSE false 
        END AS connectionRequest
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        LEFT JOIN notifications n 
            ON n.sender_user_id = ? AND n.receiver_user_id = u.id
        LEFT JOIN notifications n2
            ON n2.receiver_user_id = ? AND n2.sender_user_id = u.id
        WHERE u.looking_for = ?
        `;
    
        const queryParams = [user_id, user_id, user_id, user_id, lookingFor];
        const conditions = [];
    
        // UI Filters (AND)
        for (const [key, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue;
    
        switch (key) {
            case 'verificationStatus':
            if (values.includes('verified')) conditions.push(`p.verified = 1`);
            break;
    
            case 'photoSettings':
            const photoConds = [];
            if (values.includes('public')) photoConds.push(`p.photo_privacy = 'public'`);
            if (values.includes('protected')) photoConds.push(`p.photo_privacy = 'protected'`);
            if (photoConds.length) conditions.push(`(${photoConds.join(' OR ')})`);
            break;
    
            case 'recentlyJoined':
            const days = parseInt(values[0]);
            if (!isNaN(days)) {
                conditions.push(`p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
                queryParams.push(days);
            }
            break;
    
            case 'maritalStatus':
            conditions.push(`p.marital_status IN (?)`);
            queryParams.push(values);
            break;
    
            case 'religion':
            conditions.push(`u.religion IN (?)`);
            queryParams.push(values);
            break;
    
            case 'diet':
            conditions.push(`p.diet IN (?)`);
            queryParams.push(values);
            break;
    
            case 'country':
            conditions.push(`p.living_in IN (?)`);
            queryParams.push(values);
            break;
    
            case 'income':
            const incomeConditions = [];
            for (const range of values) {
                switch (range) {
                case '0-1':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 0 AND 1`);
                    break;
                case '1-5':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5`);
                    break;
                case '5-10':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10`);
                    break;
                case '10-20':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20`);
                    break;
                case '20+':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) > 20`);
                    break;
                }
            }
            if (incomeConditions.length > 0) {
                conditions.push(`(${incomeConditions.join(' OR ')})`);
            }
            break;
        }
        }
    
        // Partner Preferences (ALL must match)
        const preferenceConditions = [];
        if (partnerPrefs) {
        const basic = partnerPrefs.basic || {};
        const community = partnerPrefs.community || {};
        const education = partnerPrefs.education || {};
        const location = partnerPrefs.location || {};
        const other = partnerPrefs.otherDetails || {};
    
        // Age Range
        if (basic.ageRange) {
            const [minAge, maxAge] = basic.ageRange.split('–').map(a => parseInt(a.trim()));
            if (!isNaN(minAge) && !isNaN(maxAge)) {
            preferenceConditions.push(`TIMESTAMPDIFF(YEAR, u.dob, CURDATE()) BETWEEN ${minAge} AND ${maxAge}`);
            }
        }
    
        // Height Range
        if (basic.heightRange) {
            const [minStr, maxStr] = basic.heightRange.replace(/[′″]/g, `'`).split('–').map(s => s.trim());
    
            const toInches = (h) => {
            const [ft, inchPart] = h.split("'");
            const inch = parseInt(inchPart?.replace(/[^\d]/g, '') || '0');
            return parseInt(ft) * 12 + inch;
            };
    
            const min = toInches(minStr);
            const max = toInches(maxStr);
    
            preferenceConditions.push(`
            (
                (CAST(SUBSTRING_INDEX(p.height, 'ft', 1) AS UNSIGNED) * 12 +
                CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(p.height, 'ft ', -1), 'in', 1) AS UNSIGNED))
                BETWEEN ${min} AND ${max}
            )
            `);
        }
    
        if (basic.maritalStatus && basic.maritalStatus !== 'Open to All') {
            preferenceConditions.push(`p.marital_status = ${pool.escape(basic.maritalStatus)}`);
        }
    
        if (community.religion && community.religion !== 'Open to All') {
            preferenceConditions.push(`u.religion = ${pool.escape(community.religion)}`);
        }
    
        if (community.community && community.community !== 'Open to All') {
            preferenceConditions.push(`p.community = ${pool.escape(community.community)}`);
        }
    
        if (community.motherTongue && community.motherTongue !== 'Open to All') {
            preferenceConditions.push(`p.mother_tongue = ${pool.escape(community.motherTongue)}`);
        }
    
        if (education.qualification && education.qualification !== 'Open to All') {
            const eduMap = {
            "High School": ["10th", "12th", "High School", "Secondary School"],
            "Bachelor's Degree": ["B.Tech", "BE", "B.Sc", "BA", "BBA", "B.Com"],
            "Master's Degree": ["MCA", "MBA", "M.Tech", "ME", "MSc", "MA"],
            "PhD": ["PhD", "Doctorate", "DPhil"],
            "Other": ["Diploma", "Associate Degree", "Other"]
            };
    
            const mappedValues = eduMap[education.qualification];
            if (mappedValues) {
            preferenceConditions.push(`u.education IN (${mappedValues.map(val => pool.escape(val)).join(', ')})`);
            } else {
            preferenceConditions.push(`u.education = ${pool.escape(education.qualification)}`);
            }
        }
    
        if (education.workingWith && education.workingWith !== 'Open to All') {
            preferenceConditions.push(`p.working_with = ${pool.escape(education.workingWith)}`);
        }
    
        if (education.profession && education.profession !== 'Open to All') {
            preferenceConditions.push(`p.profession = ${pool.escape(education.profession)}`);
        }
    
        if (education.annualIncome && education.annualIncome !== 'Open to All') {
            const match = education.annualIncome.match(/INR\s*(\d+)\s*lakh.*?(\d+)\s*lakh/i);
            if (match) {
            const min = parseInt(match[1]);
            const max = parseInt(match[2]);
            preferenceConditions.push(`
                CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN ${min} AND ${max}
            `);
            }
        }
    
    
        if (location.country && location.country !== 'Open to All') {
            const escapedCountry = pool.escape(location.country);
        preferenceConditions.push(`(p.living_in = ${escapedCountry} OR u.country = ${escapedCountry})`);
        }
    
        if (other.diet && other.diet !== 'Open to All') {
            preferenceConditions.push(`p.diet = ${pool.escape(other.diet)}`);
        }
    
        if (other.profileManagedBy && other.profileManagedBy !== 'Open to All') {
            preferenceConditions.push(`p.profile_managed_by = ${pool.escape(other.profileManagedBy)}`);
        }
        }
    
        // Merge WHERE conditions
        if (conditions.length > 0) {
        baseQuery += ' AND ' + conditions.join(' AND ');
        }
    
        if (preferenceConditions.length > 0) {
        baseQuery += ' AND ' + preferenceConditions.join(' AND ');
        }
    
        const [rows] = await pool.query(baseQuery, queryParams);
        return rows;
    } catch (error) {
        console.error('Error fetching new matches:', error);
        throw error;
    }
    }

    static async getNewMatchesByLookingFor(user_id, lookingFor, filters = {}) {
    try {
        let baseQuery = `
        SELECT u.id AS user_id,
       u.profileId,
       u.first_name,
       u.last_name,
       u.email,
       u.looking_for,
       u.dob,
       u.religion,
       u.education,
       u.country,
       u.online_status,
       p.*,
       CASE 
           WHEN n.id IS NOT NULL 
                AND n.sender_user_id = ? 
                AND n.receiver_user_id = u.id 
                AND n.status IN ('pending', 'accepted') 
           THEN true 
           WHEN n2.id IS NOT NULL
                AND n2.receiver_user_id = ?
                AND n2.sender_user_id = u.id
                AND n2.status IN ('pending', 'accepted')
           THEN true
           ELSE false 
        END AS connectionRequest
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        LEFT JOIN notifications n 
            ON n.sender_user_id = ? AND n.receiver_user_id = u.id
        LEFT JOIN notifications n2
            ON n2.receiver_user_id = ? AND n2.sender_user_id = u.id
        WHERE u.looking_for = ?
        `;

        const queryParams = [user_id, user_id,user_id, user_id, lookingFor];
        const conditions = [];

        // Process each filter
        for (const [key, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue;
    
        switch(key) {
            case 'verificationStatus':
            if (values.includes('verified')) {
                conditions.push(`p.verified = 1`);
            }
            break;
            
            case 'photoSettings':
            if (values.includes('public')) {
                conditions.push(`p.photo_privacy = 'public'`);
            }
            if (values.includes('protected')) {
                conditions.push(`p.photo_privacy = 'protected'`);
            }
            break;
            
            case 'recentlyJoined':
            // Only one value for radio buttons
            const days = parseInt(values[0]);
            if (!isNaN(days)) {
                conditions.push(`p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
                queryParams.push(days);
            }
            break;
            
            case 'maritalStatus':
            conditions.push(`p.marital_status IN (?)`);
            queryParams.push(values);
            break;
            
            case 'religion':
            conditions.push(`u.religion IN (?)`);
            queryParams.push(values);
            break;
            
            case 'diet':
            conditions.push(`p.diet IN (?)`);
            queryParams.push(values);
            break;
            
            case 'country':
            conditions.push(`p.living_in IN (?)`);
            queryParams.push(values);
            break;
            
            case 'income':
            const incomeConditions = [];
    
            for (const range of values) {
                switch (range) {
                case '0-1':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 0 AND 1`);
                    break;
                case '1-5':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5`);
                    break;
                case '5-10':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10`);
                    break;
                case '10-20':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20`);
                    break;
                case '20+':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) > 20`);
                    break;
                }
            }
    
            if (incomeConditions.length > 0) {
                conditions.push(`(${incomeConditions.join(' OR ')})`);
            }
            break;
    
        }
        }
    
        if (conditions.length > 0) {
        baseQuery += ' AND ' + conditions.join(' AND ');
        }
        // let formatted = baseQuery;
        // queryParams.forEach((param) => {
        //     formatted = formatted.replace('?', typeof param === 'string' ? `'${param}'` : param);
        // });
        // console.log("New Matches executed query: ", formatted);
        const [rows] = await pool.query(baseQuery, queryParams);
        return rows;
    } catch (error) {
        console.error('Error fetching new matches:', error);
        throw error;
    }
    }

    static async getNewMatchesByNearMe(user_id, lookingFor, nearMe, filters = {}) {
    try {
        let baseQuery = `
        SELECT u.id AS user_id,
       u.profileId,
       u.first_name,
       u.last_name,
       u.email,
       u.looking_for,
       u.dob,
       u.religion,
       u.education,
       u.country,
       u.online_status,
       p.*,
       CASE 
           WHEN n.id IS NOT NULL 
                AND n.sender_user_id = ? 
                AND n.receiver_user_id = u.id 
                AND n.status IN ('pending', 'accepted') 
           THEN true 
           WHEN n2.id IS NOT NULL
                AND n2.receiver_user_id = ?
                AND n2.sender_user_id = u.id
                AND n2.status IN ('pending', 'accepted')
           THEN true
           ELSE false 
        END AS connectionRequest
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        LEFT JOIN notifications n 
            ON n.sender_user_id = ? AND n.receiver_user_id = u.id
        LEFT JOIN notifications n2
            ON n2.receiver_user_id = ? AND n2.sender_user_id = u.id
        WHERE u.looking_for = ? AND p.city = ?
        `;

        const queryParams = [user_id, user_id,user_id, user_id,lookingFor, nearMe];
        const conditions = [];
        console.log("Near me New Matches filters: ", filters);
        // Process each filter
        for (const [key, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue;
    
        switch(key) {
            case 'verificationStatus':
            if (values.includes('verified')) {
                conditions.push(`p.verified = 1`);
            }
            break;
            
            case 'photoSettings':
            if (values.includes('public')) {
                conditions.push(`p.photo_privacy = 'public'`);
            }
            if (values.includes('protected')) {
                conditions.push(`p.photo_privacy = 'protected'`);
            }
            break;
            
            case 'recentlyJoined':
            const days = parseInt(values[0]);
            if (!isNaN(days)) {
                conditions.push(`p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
                queryParams.push(days);
            }
            break;
            
            case 'maritalStatus':
            conditions.push(`p.marital_status IN (?)`);
            queryParams.push(values);
            break;
            
            case 'religion':
            conditions.push(`u.religion IN (?)`);
            queryParams.push(values);
            break;
            
            case 'diet':
            conditions.push(`p.diet IN (?)`);
            queryParams.push(values);
            break;
            
            case 'country':
            conditions.push(`p.living_in IN (?)`);
            queryParams.push(values);
            break;
            
            case 'income':
            const incomeConditions = [];
    
            for (const range of values) {
                switch (range) {
                case '0-1':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 0 AND 1`);
                    break;
                case '1-5':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5`);
                    break;
                case '5-10':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10`);
                    break;
                case '10-20':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20`);
                    break;
                case '20+':
                    incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) > 20`);
                    break;
                }
            }
    
            if (incomeConditions.length > 0) {
                conditions.push(`(${incomeConditions.join(' OR ')})`);
            }
            break;
    
        }
        }
    
        if (conditions.length > 0) {
        baseQuery += ' AND ' + conditions.join(' AND ');
        }
    
        const [rows] = await pool.query(baseQuery, queryParams);
        return rows;
    } catch (error) {
        console.error('Error fetching new matches:', error);
        throw error;
    }
    }

    static async getShortlisted(lookingFor, filters = {}, userId) {
        try {
            let baseQuery = `
            SELECT
                u.id AS user_id,
                u.profileId,
                u.first_name,
                u.last_name,
                u.email,
                u.looking_for,
                u.dob,
                u.religion,
                u.education,
                u.country,
                u.online_status,
                p.*,
                n1.created_at AS your_request_time,
                n2.created_at AS their_request_time,
                n1.status AS your_request_status,
                n2.status AS their_request_status,
                
                CASE 
                WHEN n1.id IS NOT NULL OR n2.id IS NOT NULL THEN true
                ELSE false
                END AS connectionRequest

            FROM users u
            JOIN profiles p ON u.id = p.user_id
            LEFT JOIN notifications n1 ON n1.sender_user_id = ? AND n1.receiver_user_id = u.id AND n1.status IN ('pending', 'accepted')
            LEFT JOIN notifications n2 ON n2.sender_user_id = u.id AND n2.receiver_user_id = ? AND n2.status IN ('pending', 'accepted')
            WHERE u.looking_for = ?
                AND (n1.id IS NOT NULL OR n2.id IS NOT NULL)
            `;
            const queryParams = [userId, userId, lookingFor];
            const conditions = [];

            for (const [key, values] of Object.entries(filters)) {
            if (!values || values.length === 0) continue;

            switch (key) {
                case "verificationStatus":
                if (values.includes("verified")) conditions.push(`p.verified = 1`);
                break;

                case "photoSettings":
                if (values.includes("public")) conditions.push(`p.photo_privacy = 'public'`);
                if (values.includes("protected")) conditions.push(`p.photo_privacy = 'protected'`);
                break;

                case "recentlyJoined":
                const days = parseInt(values[0]);
                if (!isNaN(days)) {
                    conditions.push(`p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
                    queryParams.push(days);
                }
                break;

                case "maritalStatus":
                conditions.push(`p.marital_status IN (?)`);
                queryParams.push(values);
                break;

                case "religion":
                conditions.push(`u.religion IN (?)`);
                queryParams.push(values);
                break;

                case "diet":
                conditions.push(`p.diet IN (?)`);
                queryParams.push(values);
                break;

                case "country":
                conditions.push(`p.living_in IN (?)`);
                queryParams.push(values);
                break;

                case "income":
                const incomeConditions = [];

                for (const range of values) {
                    switch (range) {
                    case "0-1":
                        incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 0 AND 1`);
                        break;
                    case "1-5":
                        incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5`);
                        break;
                    case "5-10":
                        incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10`);
                        break;
                    case "10-20":
                        incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20`);
                        break;
                    case "20+":
                        incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) > 20`);
                        break;
                    }
                }

                if (incomeConditions.length > 0) {
                    conditions.push(`(${incomeConditions.join(" OR ")})`);
                }
                break;
            }
            }

            if (conditions.length > 0) {
            baseQuery += " AND " + conditions.join(" AND ");
            }

            const [rows] = await pool.query(baseQuery, queryParams);

            const enrichedRows = rows.map((row) => {
            const userIdStr = String(row.user_id);
            return {
                ...row,
                online: onlineUsers.has(userIdStr),
                last_seen: lastSeenMap.get(userIdStr) || null,
                status: row.notification_status,
                connectionRequest: row.connectionRequest === 1 // MySQL may return 1/0
            };
            });

            return enrichedRows;
        } catch (error) {
            console.error("Error fetching shortlisted matches:", error);
            throw error;
        }
    }
}

 module.exports = Matches;