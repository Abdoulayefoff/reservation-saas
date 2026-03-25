<?php

use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

// PHPUnit sets $_SERVER['APP_ENV'] = 'test' via phpunit.dist.xml.
// Docker may have set $_ENV['APP_ENV'] = 'dev' which bootEnv() would
// read first, causing the kernel to boot in the wrong environment.
// Synchronise $_ENV so bootEnv() picks up the correct value.
if (isset($_SERVER['APP_ENV'])) {
    $_ENV['APP_ENV'] = $_SERVER['APP_ENV'];
}

if (method_exists(Dotenv::class, 'bootEnv')) {
    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}

if ($_SERVER['APP_DEBUG']) {
    umask(0000);
}
