<?php
require_once __DIR__ . '/db.php';

function nc_current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    static $user = null;
    if ($user !== null) {
        return $user;
    }
    $pdo = nc_db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch() ?: null;
    return $user;
}

function nc_require_login(): array
{
    $user = nc_current_user();
    if (!$user) {
        header('Location: login.php');
        exit;
    }
    return $user;
}

function nc_register(string $name, string $email, string $password): array
{
    $pdo = nc_db();
    $email = strtolower(trim($email));

    if ($name === '' || $email === '' || strlen($password) < 6) {
        return [false, "Merci de remplir tous les champs (mot de passe : 6 caractères minimum)."];
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return [false, "Adresse e-mail invalide."];
    }

    $check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $check->execute([$email]);
    if ($check->fetch()) {
        return [false, "Un compte existe déjà avec cet e-mail."];
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
    $stmt->execute([$name, $email, $hash]);
    $userId = (int)$pdo->lastInsertId();

    $pdo->prepare('INSERT INTO profiles (user_id) VALUES (?)')->execute([$userId]);
    $pdo->prepare('INSERT INTO points (user_id, total_points) VALUES (?, 0)')->execute([$userId]);

    $_SESSION['user_id'] = $userId;
    return [true, ''];
}

function nc_login(string $email, string $password): array
{
    $pdo = nc_db();
    $email = strtolower(trim($email));
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return [false, "E-mail ou mot de passe incorrect."];
    }

    $_SESSION['user_id'] = (int)$user['id'];
    return [true, ''];
}

function nc_logout(): void
{
    $_SESSION = [];
    session_destroy();
}
