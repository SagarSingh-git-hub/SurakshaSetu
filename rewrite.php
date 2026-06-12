<?php
$content = file_get_contents('php://stdin');
$content = str_replace('Co-authored-by: Cursor <cursoragent@cursor.com>', '', $content);
echo $content;
