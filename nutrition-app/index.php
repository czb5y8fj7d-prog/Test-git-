<?php
require_once __DIR__ . '/config.php';

if (nc_current_user()) {
    header('Location: dashboard.php');
} else {
    header('Location: login.php');
}
exit;
