<?php
// Portable entry point for shared hosting where this project folder itself is
// inside public_html. Local setups may still point the document root at public/.
header('Location: public/');
exit;
