const pool = require('../config/db');

exports.searchProfiles = async (req, res) => {
  try {
    const {
      searchType,
      looking_for,
      ageFrom,
      ageTo,
      heightFrom,
      heightTo,
      maritalStatus,
      religion,
      motherTongue,
      community,
      country,
      state,
      residencyStatus,
      countryGrew,
      qualification,
      educationArea,
      workingWith,
      professionArea,
      annualIncome,
      diet,
      keywords,
      page = 1,
      limit = 20,
      skipRecentSave = false
    } = req.query;

    // Validate required parameters
    if (!looking_for || !['Bride', 'Groom'].includes(looking_for)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or missing 'looking_for' parameter (must be 'Bride' or 'Groom')"
      });
    }

    // Build the base query
    let baseQuery = `
      SELECT 
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.education,
        u.country,
        p.*
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ?
    `;

    const queryParams = [looking_for];
    const conditions = [];

    // Age filter
    if (ageFrom && ageTo) {
      conditions.push(`TIMESTAMPDIFF(YEAR, u.dob, CURDATE()) BETWEEN ? AND ?`);
      queryParams.push(ageFrom, ageTo);
    }

    // Height filter - simplified approach
    if (heightFrom && heightTo) {
      // Convert height strings to total inches for comparison
      const toInches = (heightStr) => {
        const match = heightStr.match(/(\d+)ft (\d+)in/);
        if (match) {
          return parseInt(match[1]) * 12 + parseInt(match[2]);
        }
        return 0;
      };

      const minInches = toInches(heightFrom);
      const maxInches = toInches(heightTo);
      console.log(`Height range in inches: ${minInches} to ${maxInches}`);

      if (minInches && maxInches) {
        conditions.push(`
          (
            (CAST(SUBSTRING_INDEX(p.height, 'ft', 1) AS UNSIGNED) * 12 +
            CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(p.height, ' ', -1), 'in', 1) AS UNSIGNED)
            BETWEEN ? AND ?)
          )
        `);
        queryParams.push(minInches, maxInches);
      }
    }

    // Marital status filter
    if (maritalStatus && maritalStatus !=='Open for All') {
      conditions.push(`p.marital_status = ?`);
      queryParams.push(maritalStatus);
    }

    // Religion filter
    if (religion && religion !=='Open for All') {
      conditions.push(`u.religion = ?`);
      queryParams.push(religion);
    }

    // Mother tongue filter
    if (motherTongue && motherTongue !== 'Open for All') {
      const tongues = motherTongue.split(',');
      conditions.push(`p.mother_tongue IN (?)`);
      queryParams.push(tongues);
    }

    // Community filter
    if (community && community !== 'Open for All') {
      conditions.push(`p.community = ?`);
      queryParams.push(community);
    }

    // Country filter
    if (country && country !== 'Open for All') {
      conditions.push(`(p.living_in = ? OR u.country = ?)`);
      queryParams.push(country, country);
    }

    // Qualification filter
    if (qualification && qualification !== 'Open for All') {
      conditions.push(`u.education = ?`);
      queryParams.push(qualification);
    }

    // Working with filter
    if (workingWith && workingWith !== 'Open for All') {
      conditions.push(`p.work_type = ?`);
      queryParams.push(workingWith);
    }

    if (professionArea && professionArea !== 'Open for All') {
      conditions.push(`p.profession = ?`);
      queryParams.push(professionArea);
    }

    // Annual income filter
    if (annualIncome && annualIncome !== 'Open for All') {
      conditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) >= ?`);
      queryParams.push(annualIncome);
    }

    // Diet filter
    if (diet && diet !== 'Open for All') {
      conditions.push(`p.diet = ?`);
      queryParams.push(diet);
    }

    // Keyword search
    if (keywords) {
      conditions.push(`(p.profile_description LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`);
      queryParams.push(`%${keywords}%`, `%${keywords}%`, `%${keywords}%`);
    }

    // Combine all conditions
    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }

    // Add ORDER BY and pagination
    baseQuery += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), (page - 1) * limit);

    const formattedQuery = formatQuery(baseQuery, queryParams);
    console.log('Executing SQL Query:', formattedQuery);
    // Execute the query
    const [profiles] = await pool.query(baseQuery, queryParams);

    // Get total count for pagination (without LIMIT/OFFSET)
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ?
      ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
    `;
    const countParams = [looking_for === 'Bride' ? 'Groom' : 'Bride', ...queryParams.slice(1, -2)];
    const [totalResult] = await pool.query(countQuery, countParams);
    const total = totalResult[0]?.total || 0;

    if (!skipRecentSave && req.user && req.user.id) {
      console.log("SearchType:", searchType);
      try {
        await pool.query(
          'INSERT INTO recent_searches (user_id, search_type, search_params) VALUES (?, ?, ?)',
          [
            req.user.id,
            searchType || 'Basic',
            JSON.stringify(req.query)
          ]
        );
      } catch (saveError) {
        console.error('Error saving recent search:', saveError);
      }
    }

    return res.status(200).json({
      success: true,
      data: profiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error in searchProfiles:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};  

function formatQuery(sql, params) {
  let formatted = sql;
  params.forEach((param) => {
    formatted = formatted.replace('?', typeof param === 'string' ? `'${param}'` : param);
  });
  return formatted;
}

exports.searchProfilesFilter = async (req, res) => {
  try {
    const {
      searchType,
      looking_for,
      ageFrom,
      ageTo,
      heightFrom,
      heightTo,
      maritalStatus,
      religion,
      motherTongue = [],
      community,
      country,
      residencyStatus,
      countryGrew,
      qualification,
      educationArea,
      workingWith,
      professionArea,
      annualIncome,
      diet = [],
      keywords,
      page = 1,
      limit = 20,
      recentlyJoined,
    } = req.body;
    if (!looking_for || !['Bride', 'Groom'].includes(looking_for)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing 'looking_for' parameter (must be 'Bride' or 'Groom')"
      });
    }

    let baseQuery = `
      SELECT 
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.education,
        u.country,
        p.*
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ?
    `;

    const queryParams = [looking_for];
    const conditions = [];

    if (ageFrom && ageTo) {
      conditions.push(`TIMESTAMPDIFF(YEAR, u.dob, CURDATE()) BETWEEN ? AND ?`);
      queryParams.push(parseInt(ageFrom), parseInt(ageTo));
    }

    if (heightFrom && heightTo) {
      const parseHeightToInches = (heightStr) => {
        if (!heightStr) return null;
        const match = heightStr.match(/(\d+)ft\s*(\d*)in/);
        if (match) {
          const feet = parseInt(match[1]);
          const inches = match[2] ? parseInt(match[2]) : 0;
          return feet * 12 + inches;
        }
        return null;
      };

      const minInches = parseHeightToInches(heightFrom);
      const maxInches = parseHeightToInches(heightTo);

      if (minInches !== null && maxInches !== null) {
        conditions.push(`
          (
            (SUBSTRING_INDEX(p.height, 'ft', 1) * 12 + 
            IFNULL(SUBSTRING_INDEX(SUBSTRING_INDEX(p.height, ' ', -1), 'in', 1), 0)
          ) BETWEEN ? AND ?)
        `);
        queryParams.push(minInches, maxInches);
      }
    }

    if (maritalStatus && maritalStatus.length > 0 && maritalStatus[0] !== 'Open for All') {
      if (Array.isArray(maritalStatus)) {
        conditions.push(`p.marital_status IN (?)`);
        queryParams.push(maritalStatus);
      }
    }

    if (religion && religion.length > 0 && religion[0] !== 'Open for All') {
      if (Array.isArray(religion)) {
        conditions.push(`u.religion IN (?)`);
        queryParams.push(religion);
      }
    }

    if (motherTongue && motherTongue[0] !== 'Open for All' && motherTongue.length > 0) {
      const tongues = Array.isArray(motherTongue) ? motherTongue : [motherTongue];
      conditions.push(`p.mother_tongue IN (?)`);
      queryParams.push(tongues);
    }

    if (community && community.length > 0 && community[0] !== 'Open for All') {
      if (Array.isArray(community)) {
        conditions.push(`p.community IN (?)`);
        queryParams.push(community);
      }
    }
    if (professionArea && professionArea.length > 0 && professionArea[0] !== 'Open for All') {
      if (Array.isArray(professionArea)) {
        conditions.push(`p.profession IN (?)`);
        queryParams.push(professionArea);
      }
    }
    if (diet && diet.length>0 && diet[0] !== 'Open for All') {
      if (Array.isArray(diet)) {
        conditions.push(`p.diet IN (?)`);
        queryParams.push(diet);
      }
    }
    if (workingWith && workingWith.length>0 && workingWith[0] !== 'Open for All') {
      if (Array.isArray(workingWith)) {
        conditions.push(`p.work_type IN (?)`);
        queryParams.push(workingWith);
      }
    }
    if (qualification && qualification.length > 0 && qualification[0] !== 'Open for All') {
      if (Array.isArray(qualification)) {
        conditions.push(`p.qualification IN (?)`);
        queryParams.push(qualification);
      }
    }

    if (country && country.length > 0 && country[0] !== 'Open for All') {
      if (Array.isArray(country)) {
        conditions.push(`(p.living_in IN (?) OR u.country IN (?))`);
        queryParams.push(country, country);
      }
    }

    // Income renamed from annual_income to income
    if (annualIncome && annualIncome.length > 0 && annualIncome[0] !== 'Open for All') {
      if (Array.isArray(annualIncome)) {
        const incomeConditions = annualIncome.map(range => {
          if (range === '0-1') return `(CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) <= 1)`;
          if (range === '1-5') return `(CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5)`;
          if (range === '5-10') return `(CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10)`;
          if (range === '10-20') return `(CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20)`;
          if (range === '20+') return `(CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) >= 20)`;
          return '';
        }).filter(Boolean);

        if (incomeConditions.length > 0) {
          conditions.push(`(${incomeConditions.join(' OR ')})`);
        }
      }
    }

    if (keywords) {
      conditions.push(`(p.profile_description LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`);
      queryParams.push(`%${keywords}%`, `%${keywords}%`, `%${keywords}%`);
    }

    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }

    baseQuery += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const formattedQuery = formatQuery(baseQuery, queryParams);
    console.log('Executing SQL Query:', formattedQuery);

    const [profiles] = await pool.query(baseQuery, queryParams);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ?
      ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
    `;
    const countParams = [looking_for, ...queryParams.slice(1, -2)];
    const [totalResult] = await pool.query(countQuery, countParams);
    const total = totalResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: profiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error in searchProfiles:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

exports.searchProfileId = async (req, res) => {
  try {
    const { profileId } = req.params; // Changed from req.query to req.params

    // Build the base query
    let baseQuery = `
      SELECT 
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.education,
        u.country,
        u.profileId,
        p.*
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.profileId = ?
    `;

    const queryParams = [profileId];    
    // Execute the query
    const [profile] = await pool.query(baseQuery, queryParams);
    
    if (!profile || profile.length === 0) {
      return res.status(200).json({
        success: false,
        message: "Profile not found"
      });
    }
    return res.status(200).json({
      success: true,
      data: profile[0], // Return the first (and should be only) profile
    });

  } catch (error) {
    console.error("Error in searchProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Recent Searches
exports.getRecentSearches = async (req, res) => {
  try {
    const [searches] = await pool.query(
      'SELECT * FROM recent_searches WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.user.id]
    );
    
    res.status(200).json({
      success: true,
      data: searches
    });
  } catch (error) {
    console.error("Error fetching recent searches:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

exports.deleteRecentSearch = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM recent_searches WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Search not found or not owned by user"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Search deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting recent search:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};