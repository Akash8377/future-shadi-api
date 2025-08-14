require("dotenv").config();
const pool = require('../config/db');

// Group definitions
const geneticGroups = {
  "Biological Attraction": [
    "ACE", "ACTN3", "ASIP", "AVPR1A", "COMT", "EDAR", "FTO", "HERC2/OCA2",
    "HLA", "LEPR", "MC1R", "PPARG", "SLC24A4", "TAS2R38", "TYR"
  ],
  "Psychological Compatibility": [
    "5-HT2A", "APOE", "ARNTL", "BDNF", "CADM2", "CLOCK", "COMT", "DRD2", "DRD4",
    "FOXP2", "GRIN2B", "KIBRA", "MAOA", "OXTR", "PER1", "PER3", "SLC6A4"
  ],
  "Birth Defect Risk": [
    "APOE", "ATP7A", "CFTR", "COL1A1", "COL1A2", "CYP21A2", "DMD", "FMR1",
    "G6PD", "GJB2", "GLB1", "HBA1", "HBA2", "HBB", "HBB (E variant)", "HEXA",
    "HLA", "MPZ", "MTHFR Variant", "PAH", "SMN1", "TSC1", "TSC2"
  ],
  "Reproductive Health": [
    "BRCA1", "BRCA2", "CFTR", "COMT", "FMR1", "GALT", "HLA", "LEPR",
    "MTHFR", "PHEX"
  ]
};

// Grouping helper
function groupMarkers(markers) {
  const grouped = {
    "Biological Attraction": {},
    "Psychological Compatibility": {},
    "Birth Defect Risk": {},
    "Reproductive Health": {},
    "Other": {}
  };

  for (const [gene, response] of Object.entries(markers)) {
    let matched = false;
    for (const [group, geneList] of Object.entries(geneticGroups)) {
      if (geneList.includes(gene)) {
        grouped[group][gene] = response;
        matched = true;
        break;
      }
    }
    if (!matched) {
      grouped["Other"][gene] = response;
    }
  }

  return grouped;
}

// Get genetic markers for current user (grouped)
exports.getGeneticMarkers = async (req, res) => {
  try {
    const user_id = req.user?.id;
    // console.log("Get Genetic Markers user_id : ",user_id)
    if (!user_id) {
      return res.status(400).json({ msg: "User ID is required." });
    }

    const query = `
      SELECT gm.gene_name, gm.response, gm.created_at, gm.updated_at, 
             u.first_name, u.last_name 
      FROM genetic_markers gm 
      JOIN users u ON gm.user_id = u.id 
      WHERE gm.user_id = ?
    `;

    const [results] = await pool.query(query, [user_id]); // Destructure to get rows directly

    if (!results || results.length === 0) {
      return res.status(404).json({ msg: "No genetic markers found for this user." });
    }

    const { first_name, last_name } = results[0];

    const markers = {};
    results.forEach((row) => {
      markers[row.gene_name] = row.response;
    });

    const groupedMarkers = groupMarkers(markers);

    return res.status(200).json({ 
      user_id, 
      first_name, 
      last_name, 
      grouped_genetic_markers: groupedMarkers 
    });
  } catch (error) {
    console.error("Error fetching genetic markers:", error);
    return res.status(500).json({ msg: "Internal server error", error: error.message });
  }
};


exports.getNewMatchesWithGeneticMarkers = async (req, res) => {
  try {
    const { user_id, looking_for, ...filters } = req.query;

    if (!looking_for || !['Bride', 'Groom'].includes(looking_for)) {
      return res.status(400).json({ message: "Invalid 'looking_for' value" });
    }
    
    console.log("getNewMatchesWithGeneticMarkers user_id : ", user_id);
    console.log("getNewMatchesWithGeneticMarkers looking_for : ", looking_for);
    console.log("getNewMatchesWithGeneticMarkers filters : ", filters);
    
    const processedFilters = {};

    for (let [key, value] of Object.entries(filters)) {
      key = key.replace(/\[\]$/, '');
      if (typeof value === 'string') {
        value = value.split(',');
      }
      if (value.includes('all')) continue;
      processedFilters[key] = value;
    }

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
      AND EXISTS (
          SELECT 1 FROM genetic_markers gm 
          WHERE gm.user_id = u.id
      )
    `;

    const queryParams = [user_id, user_id, user_id, user_id, looking_for];
    const conditions = [];
    console.log("getNewMatchesWithGeneticMarkers processedFilters : ", processedFilters);
    
    // Apply filters
    for (const [key, values] of Object.entries(processedFilters)) {
      if (!values || values.length === 0) continue;

      switch (key) {
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

    // Get users with profile + notifications
    const [users] = await pool.query(baseQuery, queryParams);

    if (users.length === 0) return res.status(200).json({ success: true, users: [] });
    
    console.log("getNewMatchesWithGeneticMarkers users found: ", users.length);
    
    // Get all genetic markers for these users in one query
    const userIds = users.map(u => u.user_id);
    const [markers] = await pool.query(`
      SELECT gm.user_id, gm.gene_name, gm.response
      FROM genetic_markers gm
      WHERE gm.user_id IN (?)
    `, [userIds]);

    // Group markers by user
    const markersByUser = {};
    markers.forEach(row => {
      if (!markersByUser[row.user_id]) markersByUser[row.user_id] = {};
      markersByUser[row.user_id][row.gene_name] = row.response;
    });

    // Transform to include grouped genetic markers
    const result = users.map(user => {
      const flatMarkers = markersByUser[user.user_id] || {};
      return {
        ...user,
        grouped_genetic_markers: groupMarkers(flatMarkers)
      };
    });

    console.log("returning response with merged data", result.length);

    return res.status(200).json({ success: true, users: result });

  } catch (error) {
    console.error('Error fetching new matches with genetic markers:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// Save genetic markers
exports.saveGeneticMarkers = async (req, res) => {
  try {
    const user_id = req.user?.id;
    const markers = req.body;
    const values = [];

    if (!user_id) {
      return res.status(400).json({ msg: "User ID is required." });
    }

    for (const [gene_name, response] of Object.entries(markers || {})) {
      const response_value = parseInt(response, 10);

      if (isNaN(response_value) || (response_value !== 0 && response_value !== 1)) {
        return res.status(400).json({ msg: `Invalid response value for ${gene_name}. Must be 0 or 1.` });
      }

      values.push([user_id, gene_name, response_value]);
    }

    if (values.length === 0) {
      return res.status(400).json({ msg: "No valid genetic markers provided." });
    }

    const query = `
      INSERT INTO genetic_markers (user_id, gene_name, response) 
      VALUES ? 
      ON DUPLICATE KEY UPDATE response = VALUES(response), updated_at = NOW();
    `;

    const response = await pool.query(query, [values]);
    if (response.error) {
      console.error("DB error:", response.error);
      return res.status(500).json({ msg: "Database error", error: response.error });
    }

    console.log("DB insert/update done, sending response...");
    return res.status(200).json({ msg: "Genetic markers response saved successfully" });
  } catch (error) {
    console.error("Unexpected error in saveGeneticMarkers:", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
};

// Get genetic markers by specific user ID (admin view)
exports.getGeneticMarkersByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ msg: "User ID is required." });
    }

    const query = `
      SELECT gm.gene_name, gm.response, gm.created_at, gm.updated_at, 
             u.first_name, u.last_name 
      FROM genetic_markers gm 
      JOIN users u ON gm.user_id = u.id 
      WHERE gm.user_id = ?
    `;

    const [results] = await pool.query(query, [user_id]); // MySQL2 returns [rows, fields]

    if (!results || results.length === 0) {
      return res.status(404).json({ msg: "No genetic markers found for this user." });
    }

    const { first_name, last_name } = results[0];
    const markers = {};

    results.forEach((row) => {
      markers[row.gene_name] = row.response;
    });

    const groupedMarkers = groupMarkers(markers);

    return res.status(200).json({
      user_id,
      first_name,
      last_name,
      grouped_genetic_markers: groupedMarkers
    });

  } catch (error) {
    console.error("Error fetching genetic markers by user ID:", error);
    return res.status(500).json({ msg: "Internal server error", error: error.message });
  }
};