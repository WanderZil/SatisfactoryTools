<?php
// SEO hardening: avoid duplicate entry points if index.php is served by the hosting platform.
// Always redirect to the canonical SPA entry (index.html at /).
header('Location: /', true, 301);
header('Cache-Control: no-cache');
exit;
