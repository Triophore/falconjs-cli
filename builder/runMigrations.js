// runMigrations.js
const fs = require('fs');
const path = require('path');
const { Sequelize, QueryInterface } = require('sequelize');

/**
 * Run migrations from a folder
 * @param {string} migrationsDir - Path to migrations folder
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {('up'|'down')} direction - 'up' to apply, 'down' to rollback
 * @param {string} [toMigration] - Run down to this migration name (optional)
 */
async function runMigrations(migrationsDir, sequelize, direction = 'up', toMigration = null) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const queryInterface = sequelize.getQueryInterface();

  // Ensure SequelizeMeta table exists
  await ensureMetaTable(queryInterface);

  const executed = await getExecutedMigrations(queryInterface);
  const allFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  let migrationsToRun = [];

  if (direction === 'up') {
    migrationsToRun = allFiles.filter(f => !executed.includes(f));
  } else if (direction === 'down') {
    const targetIndex = toMigration ? allFiles.indexOf(toMigration) : allFiles.length - 1;
    if (targetIndex === -1) throw new Error(`Migration not found: ${toMigration}`);
    migrationsToRun = allFiles
      .slice(0, targetIndex + 1)
      .filter(f => executed.includes(f))
      .reverse();
  }

  if (migrationsToRun.length === 0) {
    console.log(`No migrations to run (${direction})`);
    return;
  }

  console.log(`Running ${migrationsToRun.length} migration(s) ${direction}...`);

  for (const file of migrationsToRun) {
    const filePath = path.join(migrationsDir, file);
    const migration = require(filePath);

    console.log(`${direction === 'up' ? 'Applying' : 'Rolling back'}: ${file}`);

    try {
      if (direction === 'up') {
        await migration.up(queryInterface, Sequelize);
        await queryInterface.sequelize.query(
          `INSERT INTO "SequelizeMeta" (name) VALUES (:name)`,
          { replacements: { name: file } }
        );
      } else {
        await migration.down(queryInterface, Sequelize);
        await queryInterface.sequelize.query(
          `DELETE FROM "SequelizeMeta" WHERE name = :name`,
          { replacements: { name: file } }
        );
      }
    } catch (err) {
      console.error(`Failed on ${file}:`, err.message);
      throw err;
    }
  }

  console.log(`Completed ${direction} of ${migrationsToRun.length} migration(s)`);
}

// ── Ensure SequelizeMeta table exists
async function ensureMetaTable(queryInterface) {
  const tableExists = await queryInterface.showAllTables().then(tables => tables.includes('SequelizeMeta'));
  if (!tableExists) {
    await queryInterface.createTable('SequelizeMeta', {
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true,
      },
    });
    console.log('Created SequelizeMeta table');
  }
}

// ── Get list of executed migrations
async function getExecutedMigrations(queryInterface) {
  try {
    const result = await queryInterface.sequelize.query(
      `SELECT name FROM "SequelizeMeta" ORDER BY name`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    return result.map(row => row.name);
  } catch (err) {
    return [];
  }
}

module.exports = { runMigrations };