<?php
require_once __DIR__ . '/config.php';
nc_logout();
header('Location: login.php');
exit;
