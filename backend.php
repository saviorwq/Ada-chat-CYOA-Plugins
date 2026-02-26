<?php
/**
 * CYOA 插件后端 — 游戏数据 CRUD
 * 
 * 由 Ada Chat 的 api.php 自动加载，无需手动配置。
 * 可用常量（由 api.php 注入）：
 *   PLUGIN_ID     — 插件标识 (cyoa)
 *   PLUGIN_DIR    — 插件目录绝对路径（含尾部斜杠）
 *   PLUGIN_ACTION — 当前请求的 action 值
 */

if (!defined('PLUGIN_DIR')) {
    http_response_code(403);
    exit('Direct access denied');
}

$dataDir = PLUGIN_DIR . 'cyoa_games/';
$maxBodySize = 2 * 1024 * 1024; // 2MB

if (!is_dir($dataDir)) {
    if (!mkdir($dataDir, 0700, true)) {
        echo json_encode(['success' => false, 'error' => '无法创建数据目录']);
        exit;
    }
}

switch (PLUGIN_ACTION) {
    case 'save_game':
        if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > $maxBodySize) {
            echo json_encode(['success' => false, 'error' => '请求数据过大']);
            exit;
        }

        $raw = file_get_contents('php://input', false, null, 0, $maxBodySize + 1);
        if (strlen($raw) > $maxBodySize) {
            echo json_encode(['success' => false, 'error' => '请求数据过大']);
            exit;
        }

        $input = json_decode($raw, true);
        if (!$input) {
            echo json_encode(['success' => false, 'error' => '无效的JSON数据']);
            exit;
        }

        $gameId = isset($input['id']) ? $input['id'] : '';
        if (!$gameId || !is_string($gameId)) {
            echo json_encode(['success' => false, 'error' => '游戏ID不能为空']);
            exit;
        }

        $gameId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $gameId);
        if ($gameId === '') {
            echo json_encode(['success' => false, 'error' => '无效的游戏ID']);
            exit;
        }
        $filename = $dataDir . $gameId . '.json';

        if (file_put_contents($filename, json_encode($input, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
            echo json_encode(['success' => true, 'id' => $gameId]);
        } else {
            echo json_encode(['success' => false, 'error' => '无法写入文件']);
        }
        break;

    case 'load_game':
        $gameId = isset($_GET['id']) ? $_GET['id'] : '';
        if (!$gameId || !is_string($gameId)) {
            echo json_encode(['success' => false, 'error' => '游戏ID不能为空']);
            exit;
        }

        $gameId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $gameId);
        $filename = $dataDir . $gameId . '.json';

        if (!file_exists($filename)) {
            echo json_encode(['success' => false, 'error' => '游戏不存在']);
            exit;
        }

        $content = file_get_contents($filename);
        if ($content === false) {
            echo json_encode(['success' => false, 'error' => '无法读取文件']);
            exit;
        }

        echo $content;
        break;

    case 'list_games':
        $games = [];
        $files = glob($dataDir . '*.json');

        foreach ($files as $file) {
            $content = file_get_contents($file);
            if ($content) {
                $game = json_decode($content, true);
                if ($game && isset($game['id'])) {
                    $games[] = [
                        'id' => $game['id'],
                        'name' => isset($game['name']) ? $game['name'] : '未命名',
                        'author' => isset($game['author']) ? $game['author'] : '',
                        'version' => isset($game['version']) ? $game['version'] : '1.0',
                        'updatedAt' => isset($game['updatedAt']) ? $game['updatedAt'] : '',
                        'attributes' => isset($game['attributes']) ? count($game['attributes']) : 0,
                        'items' => isset($game['items']) ? count($game['items']) : 0,
                        'skills' => isset($game['skills']) ? count($game['skills']) : 0,
                        'quests' => isset($game['quests']) ? count($game['quests']) : 0,
                        'characters' => isset($game['characters']) ? count($game['characters']) : 0,
                        'scenes' => isset($game['scenes']) ? count($game['scenes']) : 0
                    ];
                }
            }
        }

        echo json_encode(['success' => true, 'games' => $games]);
        break;

    case 'delete_game':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'error' => 'delete_game 必须使用 POST 方法']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $gameId = isset($input['id']) ? $input['id'] : '';
        if (!$gameId || !is_string($gameId)) {
            echo json_encode(['success' => false, 'error' => '游戏ID不能为空']);
            exit;
        }

        $gameId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $gameId);
        if ($gameId === '') {
            echo json_encode(['success' => false, 'error' => '无效的游戏ID']);
            exit;
        }
        $filename = $dataDir . $gameId . '.json';

        if (file_exists($filename)) {
            if (unlink($filename)) {
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'error' => '无法删除文件']);
            }
        } else {
            echo json_encode(['success' => false, 'error' => '游戏不存在']);
        }
        break;

    default:
        echo json_encode(['success' => false, 'error' => '无效的操作']);
        break;
}
