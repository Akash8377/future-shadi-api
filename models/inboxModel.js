
const pool = require('../config/db'); 
const { onlineUsers, lastSeenMap } = require('./../utils/onlineTracker');

const InboxModel = {
  // Get notifications where the user is the receiver
 async getAllReceiverDetails(receiverUserId) {
    const [rows] = await pool.query(
      `
      SELECT 
        n.*,

        -- Sender User Limited Info
        su.id AS sender_id,
        su.first_name AS sender_first_name,
        su.last_name AS sender_last_name,
        su.email AS sender_email,
        su.religion AS sender_religion,
        su.looking_for AS sender_looking_for,
        su.online_status AS sender_online_status,

        -- Sender Profile Full Info
        sp.id AS sender_profile_id,
        sp.user_id AS sender_profile_user_id,
        sp.gender AS sender_gender,
        sp.height AS sender_height,
        sp.community AS community,
        sp.city AS sender_city,
        sp.living_in AS sender_living_in,
        sp.qualification AS sender_qualification,
        sp.profession AS sender_profession,
        sp.income AS sender_income,
        sp.profile_image AS sender_profile_image,
        sp.birth_day AS sender_birth_day,
        sp.birth_month AS sender_birth_month,
        sp.birth_year AS sender_birth_year,
        sp.created_at AS sender_profile_created_at,
        sp.updated_at AS sender_profile_updated_at,

        -- Receiver User Limited Info
        ru.first_name AS receiver_first_name,
        ru.last_name AS receiver_last_name,
        ru.email AS receiver_email,
        ru.looking_for AS receiver_looking_for

      FROM notifications n
      LEFT JOIN users su ON n.sender_user_id = su.id
      LEFT JOIN profiles sp ON sp.user_id = su.id
      LEFT JOIN users ru ON n.receiver_user_id = ru.id
      LEFT JOIN profiles rp ON rp.user_id = ru.id

      WHERE n.receiver_user_id = ?
        AND n.status = 'pending'
      ORDER BY n.created_at DESC
      `,
      [receiverUserId]
    );

    // Enhance each row with sender online status and last seen
    const enrichedRows = rows.map((row) => {
      const senderId = String(row.sender_id); // Convert to string
        const senderOnline = onlineUsers.has(senderId);
        const senderLastSeen = lastSeenMap.get(senderId) || null;

        console.log(`Sender ID: ${senderId}`);
        console.log(`Online: ${senderOnline}`);
        console.log(`Last Seen: ${senderLastSeen || 'N/A'}`);
      return {
        ...row,
        sender_online: senderOnline,
        sender_last_seen: senderLastSeen,
      };
    });

    return enrichedRows;
  },

 async getPreferenceReceiverDetails(receiverUserId, partnerPreferenceOverride = null) {
  // Helpers
  const normalizeDash = (s) => (s || '').replace(/[–—-]/g, '-').trim();

  const parseAgeRange = (ageRangeStr) => {
    if (!ageRangeStr) return null;
    const parts = normalizeDash(ageRangeStr).split('-').map(p => parseInt(p.trim(), 10));
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return { min: parts[0], max: parts[1] };
  };

  const parseHeightRange = (heightRangeStr) => {
    if (!heightRangeStr) return null;
    let normalized = heightRangeStr
      .replace(/[′‵`]/g, "'")
      .replace(/[″“”"]/g, '"')
      .toLowerCase()
      .trim();

    const toInches = (h) => {
      h = h.replace(/\s+/g, '');
      const ftInMatch = h.match(/(\d+)'(\d+)"/) || h.match(/(\d+)\s*ft\s*(\d+)\s*in/);
      if (ftInMatch) {
        return parseInt(ftInMatch[1], 10) * 12 + parseInt(ftInMatch[2], 10);
      }
      const onlyFt = h.match(/(\d+)\s*ft/);
      const onlyIn = h.match(/(\d+)\s*in/);
      const feet = onlyFt ? parseInt(onlyFt[1], 10) : 0;
      const inches = onlyIn ? parseInt(onlyIn[1], 10) : 0;
      if (feet === 0 && inches === 0) return NaN;
      return feet * 12 + inches;
    };

    const parts = normalizeDash(normalized).split('-').map(p => p.trim());
    if (parts.length !== 2) return null;
    const min = toInches(parts[0]);
    const max = toInches(parts[1]);
    if (isNaN(min) || isNaN(max)) return null;
    return { min, max };
  };

  const parseIncomeRange = (incomeStr) => {
    if (!incomeStr) return null;
    let cleaned = incomeStr.replace(/INR/i, '').trim().toLowerCase();

    const wordToNumber = (s) => {
      s = s.trim();
      const lakhMatch = s.match(/([\d,.]+)\s*lakhs?/);
      if (lakhMatch) {
        return Math.round(parseFloat(lakhMatch[1].replace(/,/g, '')) * 100000);
      }
      const croreMatch = s.match(/([\d,.]+)\s*crores?/);
      if (croreMatch) {
        return Math.round(parseFloat(croreMatch[1].replace(/,/g, '')) * 10000000);
      }
      const numMatch = s.match(/([\d,]+)/);
      if (numMatch) {
        return parseInt(numMatch[1].replace(/,/g, ''), 10);
      }
      return NaN;
    };

    const parts = cleaned.split(/\s*(?:to|-)\s*/i);
    if (parts.length !== 2) return null;

    const min = wordToNumber(parts[0]);
    const max = wordToNumber(parts[1]);
    if (isNaN(min) || isNaN(max)) return null;
    return { min, max };
  };

  const isOpen = (val) =>
    typeof val === 'string' && val.trim().toLowerCase() === 'open to all';

  try {
    // Fetch receiver to validate and get stored partner_preference from profile
    const [[receiverRow]] = await pool.query(
      `
      SELECT u.id AS user_id, p.partner_preference
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = ?
      `,
      [receiverUserId]
    );
    if (!receiverRow) {
      return { preferenceFound: false, rows: [], reason: 'receiver_not_found' };
    }

    // Determine effective partner preference: override takes precedence, else stored
    let partnerPrefs = null;
    if (partnerPreferenceOverride) {
      try {
        partnerPrefs =
          typeof partnerPreferenceOverride === 'string'
            ? JSON.parse(partnerPreferenceOverride)
            : partnerPreferenceOverride;
      } catch (e) {
        console.warn('Invalid override partner_preference JSON:', e);
        partnerPrefs = null;
      }
    } else if (receiverRow.partner_preference) {
      try {
        partnerPrefs =
          typeof receiverRow.partner_preference === 'string'
            ? JSON.parse(receiverRow.partner_preference)
            : receiverRow.partner_preference;
      } catch (e) {
        console.warn('Invalid stored partner_preference JSON:', e);
        partnerPrefs = null;
      }
    }

    if (!partnerPrefs || Object.keys(partnerPrefs).length === 0) {
      return { preferenceFound: false, rows: [], reason: 'no_preference_available' };
    }

    const selectClause = `
      SELECT 
        n.*,

        -- Sender User Limited Info
        su.first_name AS sender_first_name,
        su.last_name AS sender_last_name,
        su.email AS sender_email,
        su.religion AS sender_religion,
        su.looking_for AS sender_looking_for,
        su.online_status AS sender_online_status,

        -- Sender Profile Full Info
        sp.id AS sender_profile_id,
        sp.user_id AS sender_profile_user_id,
        sp.gender AS sender_gender,
        sp.height AS sender_height,
        sp.community AS community,
        sp.city AS sender_city,
        sp.living_in AS sender_living_in,
        sp.qualification AS sender_qualification,
        sp.profession AS sender_profession,
        sp.income AS sender_income,
        sp.profile_image AS sender_profile_image,
        sp.birth_day AS sender_birth_day,
        sp.birth_month AS sender_birth_month,
        sp.birth_year AS sender_birth_year,
        sp.created_at AS sender_profile_created_at,
        sp.updated_at AS sender_profile_updated_at,

        -- Receiver User Limited Info
        ru.first_name AS receiver_first_name,
        ru.last_name AS receiver_last_name,
        ru.email AS receiver_email,
        ru.looking_for AS receiver_looking_for

      FROM notifications n
      LEFT JOIN users su ON n.sender_user_id = su.id
      LEFT JOIN profiles sp ON sp.user_id = su.id
      LEFT JOIN users ru ON n.receiver_user_id = ru.id
      LEFT JOIN profiles rp ON rp.user_id = ru.id
    `;

    const whereClauses = [`n.receiver_user_id = ?`, `n.status = 'pending'`];
    const params = [receiverUserId];

    const basic = partnerPrefs.basic || {};
    const community = partnerPrefs.community || {};
    const education = partnerPrefs.education || {};
    const location = partnerPrefs.location || {};
    const other = partnerPrefs.otherDetails || {};

    // Gender
    if (basic.gender && !isOpen(basic.gender)) {
      whereClauses.push(`sp.gender = ?`);
      params.push(basic.gender.trim());
    }

    // Age Range
    if (basic.ageRange) {
      const ageRange = parseAgeRange(basic.ageRange);
      if (ageRange) {
        whereClauses.push(`TIMESTAMPDIFF(YEAR, su.dob, CURDATE()) BETWEEN ? AND ?`);
        params.push(ageRange.min, ageRange.max);
      } else {
        console.warn('Invalid ageRange in partner preference:', basic.ageRange);
      }
    }

    // Height Range
    if (basic.heightRange) {
      const hRange = parseHeightRange(basic.heightRange);
      if (hRange) {
        whereClauses.push(`
          (
            (
              (
                COALESCE(
                  NULLIF(REGEXP_SUBSTR(sp.height, '^(\\d+)\\s*ft'), ''), '0 ft'
                )
              ) * 12
              +
              COALESCE(
                NULLIF(REGEXP_SUBSTR(sp.height, '(\\d+)\\s*in'), ''), '0 in'
              )
            ) BETWEEN ? AND ?
          )
        `);
        params.push(hRange.min, hRange.max);
      } else {
        console.warn('Invalid heightRange in partner preference:', basic.heightRange);
      }
    }

    // Marital Status
    if (basic.maritalStatus && !isOpen(basic.maritalStatus)) {
      whereClauses.push(`sp.marital_status = ?`);
      params.push(basic.maritalStatus.trim());
    }

    // Religion
    if (community.religion && !isOpen(community.religion)) {
      whereClauses.push(`su.religion = ?`);
      params.push(community.religion.trim());
    }

    // Community
    if (community.community && !isOpen(community.community)) {
      const comms = community.community
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
      if (comms.length) {
        const placeholders = comms.map(() => '?').join(',');
        whereClauses.push(`sp.community IN (${placeholders})`);
        params.push(...comms);
      }
    }

    // Mother Tongue
    if (community.motherTongue && !isOpen(community.motherTongue)) {
      whereClauses.push(`sp.mother_tongue = ?`);
      params.push(community.motherTongue.trim());
    }

    // Education qualification
    if (education.qualification && !isOpen(education.qualification)) {
      const eduMap = {
        "High School": ["10th", "12th", "High School", "Secondary School"],
        "Bachelor's Degree": ["B.Tech", "BE", "B.Sc", "BA", "BBA", "B.Com"],
        "Master's Degree": ["MCA", "MBA", "M.Tech", "ME", "MSc", "MA"],
        "PhD": ["PhD", "Doctorate", "DPhil"],
        "Other": ["Diploma", "Associate Degree", "Other"]
      };
      const mappedValues = eduMap[education.qualification];
      if (mappedValues) {
        const placeholders = mappedValues.map(() => '?').join(',');
        whereClauses.push(`su.education IN (${placeholders})`);
        params.push(...mappedValues);
      } else {
        whereClauses.push(`su.education = ?`);
        params.push(education.qualification.trim());
      }
    }

    // Working With
    if (education.workingWith && !isOpen(education.workingWith)) {
      whereClauses.push(`sp.working_with = ?`);
      params.push(education.workingWith.trim());
    }

    // Profession
    if (education.profession && !isOpen(education.profession)) {
      whereClauses.push(`sp.profession = ?`);
      params.push(education.profession.trim());
    }

    // Annual Income
    if (education.annualIncome && !isOpen(education.annualIncome)) {
      const incomeRange = parseIncomeRange(education.annualIncome);
      if (incomeRange) {
        whereClauses.push(`
          CAST(REPLACE(SUBSTRING_INDEX(sp.income, ' ', 1), ',', '') AS UNSIGNED) BETWEEN ? AND ?
        `);
        params.push(incomeRange.min, incomeRange.max);
      } else {
        console.warn('Invalid annualIncome in partner preference:', education.annualIncome);
      }
    }

    // Location: country
    if (location.country && !isOpen(location.country)) {
      const countries = location.country
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
      if (countries.length) {
        const placeholders = countries.map(() => '?').join(',');
        whereClauses.push(`(sp.living_in IN (${placeholders}) OR su.country IN (${placeholders}))`);
        params.push(...countries, ...countries);
      }
    }

   
    // Diet
    if (other.diet && !isOpen(other.diet)) {
      whereClauses.push(`sp.diet = ?`);
      params.push(other.diet.trim());
    }

    // Profile managed by
    if (other.profileManagedBy && !isOpen(other.profileManagedBy)) {
      whereClauses.push(`sp.profile_managed_by = ?`);
      params.push(other.profileManagedBy.trim());
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const finalSQL = `
      ${selectClause}
      ${whereSQL}
      ORDER BY n.created_at DESC
    `;

    const [rows] = await pool.query(finalSQL, params);
    return { preferenceFound: true, rows };
  } catch (error) {
    console.error('Error in getPreferenceReceiverDetails with preference filter:', error);
    throw error;
  }
 },
  // Get notifications where the user is the sender
  async getAllSenderRequests(senderUserId) {
  const [rows] = await pool.query(
    `
    SELECT 
      n.*,

      -- Receiver User Info
      ru.first_name AS receiver_first_name,
      ru.last_name AS receiver_last_name,
      ru.email AS receiver_email,
      ru.religion AS receiver_religion,
      ru.looking_for AS receiver_looking_for,
      ru.online_status AS receiver_online_status,

      -- Receiver Profile Info
      rp.id AS receiver_profile_id,
      rp.user_id AS receiver_profile_user_id,
      rp.gender AS receiver_gender,
      rp.height AS receiver_height,
      rp.community AS receiver_community,
      rp.city AS receiver_city,
      rp.living_in AS receiver_living_in,
      rp.qualification AS receiver_qualification,
      rp.profession AS receiver_profession,
      rp.income AS receiver_income,
      rp.profile_image AS receiver_profile_image,
      rp.birth_day AS receiver_birth_day,
      rp.birth_month AS receiver_birth_month,
      rp.birth_year AS receiver_birth_year,
      rp.created_at AS receiver_profile_created_at,
      rp.updated_at AS receiver_profile_updated_at,

      -- Sender User Info
      su.first_name AS sender_first_name,
      su.last_name AS sender_last_name,
      su.email AS sender_email

    FROM notifications n
    LEFT JOIN users ru ON n.receiver_user_id = ru.id
    LEFT JOIN profiles rp ON rp.user_id = ru.id
    LEFT JOIN users su ON n.sender_user_id = su.id
    LEFT JOIN profiles sp ON sp.user_id = su.id

    WHERE n.sender_user_id = ?
      AND n.status = 'pending'
    ORDER BY n.created_at DESC
    `,
    [senderUserId]
  );
   const enrichedRows = rows.map((row) => {
    const receiverId = String(row.receiver_id || row.receiver_profile_user_id);
    const receiverOnline = onlineUsers.has(receiverId);
    const receiverLastSeen = lastSeenMap.get(receiverId) || null;

    console.log(`Receiver ID: ${receiverId}`);
    console.log(`Online: ${receiverOnline}`);
    console.log(`Last Seen: ${receiverLastSeen || 'N/A'}`);

    return {
      ...row,
      receiver_online: receiverOnline,
      receiver_last_seen: receiverLastSeen,
    };
  });

  return enrichedRows;
 },

  async acceptNofication(notificationId){
    const [result] = await pool.query(
        `UPDATE notifications SET status = 'accepted' WHERE id =?`,
        [notificationId]
    )
    return result;
  }, 

  async acceptedReceiver(receiverUserId) {
    const [rows] = await pool.query(
      `
      SELECT 
        n.*,

        -- Sender User Limited Info
        su.first_name AS sender_first_name,
        su.last_name AS sender_last_name,
        su.email AS sender_email,
        su.religion AS sender_religion,
        su.looking_for AS sender_looking_for,
        su.online_status AS sender_online_status,

        -- Sender Profile Full Info
        sp.id AS sender_profile_id,
        sp.user_id AS sender_profile_user_id,
        sp.gender AS sender_gender,
        sp.height AS sender_height,
        sp.community AS community,
        sp.city AS sender_city,
        sp.living_in AS sender_living_in,
        sp.qualification AS sender_qualification,
        sp.profession AS sender_profession,
        sp.income AS sender_income,
        sp.profile_image AS sender_profile_image,
        sp.birth_day AS sender_birth_day,
        sp.birth_month AS sender_birth_month,
        sp.birth_year AS sender_birth_year,
        sp.created_at AS sender_profile_created_at,
        sp.updated_at AS sender_profile_updated_at,

        -- Receiver User Limited Info
        ru.first_name AS receiver_first_name,
        ru.last_name AS receiver_last_name,
        ru.email AS receiver_email,
        ru.looking_for AS receiver_looking_for

      FROM notifications n
      LEFT JOIN users su ON n.sender_user_id = su.id
      LEFT JOIN profiles sp ON sp.user_id = su.id
      LEFT JOIN users ru ON n.receiver_user_id = ru.id
      LEFT JOIN profiles rp ON rp.user_id = ru.id

      WHERE n.receiver_user_id = ?
        AND n.status = 'accepted'
      GROUP BY n.sender_user_id
      ORDER BY n.created_at DESC
      `,
      [receiverUserId]
    );
    const enrichedRows = rows.map((row) => {
    const senderId = String(row.sender_id || row.sender_profile_user_id);
    const senderOnline = onlineUsers.has(senderId);
    const senderLastSeen = lastSeenMap.get(senderId) || null;

    return {
      ...row,
      sender_online: senderOnline,
      sender_last_seen: senderLastSeen,
    };
  });

  return enrichedRows;
  },
  
  async deleteNofication(notificationId){
    const [result] = await pool.query(
        `UPDATE notifications SET status = 'deleted' WHERE id =?`,
        [notificationId]
    )
    return result;
  }, 
  
  async deletedReceiver(receiverUserId) {
    const [rows] = await pool.query(
      `
      SELECT 
        n.*,

        -- Sender User Limited Info
        su.first_name AS sender_first_name,
        su.last_name AS sender_last_name,
        su.email AS sender_email,
        su.religion AS sender_religion,
        su.looking_for AS sender_looking_for,
        su.online_status AS sender_online_status,

        -- Sender Profile Full Info
        sp.id AS sender_profile_id,
        sp.user_id AS sender_profile_user_id,
        sp.gender AS sender_gender,
        sp.height AS sender_height,
        sp.community AS community,
        sp.city AS sender_city,
        sp.living_in AS sender_living_in,
        sp.qualification AS sender_qualification,
        sp.profession AS sender_profession,
        sp.income AS sender_income,
        sp.profile_image AS sender_profile_image,
        sp.birth_day AS sender_birth_day,
        sp.birth_month AS sender_birth_month,
        sp.birth_year AS sender_birth_year,
        sp.created_at AS sender_profile_created_at,
        sp.updated_at AS sender_profile_updated_at,

        -- Receiver User Limited Info
        ru.first_name AS receiver_first_name,
        ru.last_name AS receiver_last_name,
        ru.email AS receiver_email,
        ru.looking_for AS receiver_looking_for

      FROM notifications n
      LEFT JOIN users su ON n.sender_user_id = su.id
      LEFT JOIN profiles sp ON sp.user_id = su.id
      LEFT JOIN users ru ON n.receiver_user_id = ru.id
      LEFT JOIN profiles rp ON rp.user_id = ru.id

      WHERE n.receiver_user_id = ?
        AND n.status = 'deleted'
      GROUP BY n.sender_user_id
      ORDER BY n.created_at DESC
      `,
      [receiverUserId]
    );
    const enrichedRows = rows.map((row) => {
    const senderId = String(row.sender_id || row.sender_profile_user_id);
    const senderOnline = onlineUsers.has(senderId);
    const senderLastSeen = lastSeenMap.get(senderId) || null;

    console.log(`Sender ID: ${senderId}`);
    console.log(`Online: ${senderOnline}`);
    console.log(`Last Seen: ${senderLastSeen || 'N/A'}`);

    return {
      ...row,
      sender_online: senderOnline,
      sender_last_seen: senderLastSeen,
    };
  });

  return enrichedRows;
  },

async getChatUsers(lookingFor, filters = {}, loggedInUserId = null) {
  try {
    let baseQuery = `
      SELECT 
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.phone,
        u.education,
        u.country,
        u.online_status,
        p.*,
        CASE 
          WHEN n.id IS NOT NULL
            AND n.sender_user_id = u.id
            AND n.receiver_user_id = ?
            AND n.status IN ('pending', 'accepted')
          THEN true
          ELSE false
        END AS connectionRequest,
        (
          SELECT messages
          FROM conversations
          WHERE (user1_id = u.id AND user2_id = ?) OR (user1_id = ? AND user2_id = u.id)
          LIMIT 1
        ) AS messages,
        (
          SELECT updated_at
          FROM conversations
          WHERE (user1_id = u.id AND user2_id = ?) OR (user1_id = ? AND user2_id = u.id)
          LIMIT 1
        ) AS last_message_date
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN notifications n
        ON n.sender_user_id = u.id AND n.receiver_user_id = ?
      WHERE u.looking_for = ?
    `;
    
    const queryParams = [
      loggedInUserId, 
      loggedInUserId, loggedInUserId, // For messages subquery
      loggedInUserId, loggedInUserId, // For last_message_date subquery
      loggedInUserId, 
      lookingFor
    ];

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
    

    const [rows] = await pool.query(baseQuery, queryParams);

    const enrichedRows = rows.map((row) => {
      const userId = String(row.user_id);
      let lastMessage = null;
      
      try {
        if (row.messages) {
          const messages = JSON.parse(row.messages);
          if (messages.length > 0) {
            lastMessage = messages[messages.length - 1]; // Get last message
          }
        }
      } catch (error) {
        console.error('Error parsing messages:', error);
      }

      return {
        ...row,
        online: onlineUsers.has(userId),
        last_seen: lastSeenMap.get(userId) || null,
        connectionRequest: !!row.connectionRequest,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          sent_at: lastMessage.sent_at || row.last_message_date,
          is_sender: lastMessage.sender_id === parseInt(loggedInUserId)
        } : null,
        date: lastMessage?.sent_at || row.last_message_date || row.date
      };
    });

    return enrichedRows;
  } catch (error) {
    console.error('Error fetching new matches:', error);
    throw error;
  }
}
};

module.exports = InboxModel;
