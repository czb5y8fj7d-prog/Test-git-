-- Schéma SQLite - NutriCoach
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY,
    sex TEXT NOT NULL DEFAULT 'F',
    age INTEGER,
    height_cm REAL,
    current_weight_kg REAL,
    start_weight_kg REAL,
    target_weight_kg REAL,
    activity_level TEXT NOT NULL DEFAULT 'modere',
    goal TEXT NOT NULL DEFAULT 'perte',
    diet_pref TEXT DEFAULT '',
    allergies TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'dejeuner',
    tags TEXT DEFAULT '',
    servings INTEGER NOT NULL DEFAULT 1,
    prep_minutes INTEGER DEFAULT 15,
    kcal INTEGER NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    ingredients TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    meal_slot TEXT NOT NULL,
    recipe_id INTEGER,
    custom_text TEXT DEFAULT '',
    UNIQUE(user_id, week_start, day_of_week, meal_slot),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS weight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    note TEXT DEFAULT '',
    UNIQUE(user_id, log_date),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    label TEXT NOT NULL,
    quantity_text TEXT DEFAULT '',
    checked INTEGER NOT NULL DEFAULT 0,
    is_manual INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_checks (
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    water_glasses INTEGER NOT NULL DEFAULT 0,
    exercise_done INTEGER NOT NULL DEFAULT 0,
    sleep_hours REAL DEFAULT 0,
    PRIMARY KEY(user_id, log_date),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS points (
    user_id INTEGER PRIMARY KEY,
    total_points INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    earned_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, code),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenge_completions (
    user_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    challenge_code TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, week_start, challenge_code),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
