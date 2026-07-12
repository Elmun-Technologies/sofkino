const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

const genres = [
    'Tarjima Kinolar',
    'Premyeralar',
    'Multfilmlar',
    'Seriallar',
    'Jangari',
    'Komediya',
    'Qo\'rqinchli',
    'Melodrama',
    'Fantastika',
    'Detektiv'
];

db.serialize(() => {
    const stmt = db.prepare("INSERT OR IGNORE INTO genres (name) VALUES (?)");
    genres.forEach(genre => {
        stmt.run(genre);
    });
    stmt.finalize();
    console.log('✅ Genres seeded successfully!');
    db.close();
});
