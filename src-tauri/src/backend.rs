use regex::RegexBuilder;
use rfd::FileDialog;
use rusqlite::{backup::Backup, params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const TAG_PALETTE: [&str; 16] = [
    "#f6c4c4", "#f9d2b6", "#f7e19a", "#dbe89e", "#c2e5b8", "#aee0d7", "#b9dcf5", "#c6d0f7",
    "#d9c3f3", "#efc5e2", "#f4b8c1", "#f6c4a3", "#f2ddb1", "#d8e8c2", "#d0eef1", "#e3d5f6",
];

type DbResult<T> = Result<T, String>;

#[derive(Debug, Clone, Serialize)]
pub struct AppDataCanvas {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataNode {
    pub id: String,
    pub canvas_id: String,
    pub title: String,
    pub body: String,
    pub is_entity: i64,
    pub tags: Vec<String>,
    pub x: f64,
    pub y: f64,
    pub collapsed: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataEdge {
    pub id: String,
    pub canvas_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataTopic {
    pub id: String,
    pub canvas_id: String,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataEntity {
    pub id: String,
    pub canvas_id: String,
    pub title: String,
    pub title_key: String,
    pub primary_node_id: Option<String>,
    pub mention_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataEntityMention {
    pub id: String,
    pub canvas_id: String,
    pub entity_id: String,
    pub node_id: String,
    pub reference_text: String,
    pub title: String,
    pub title_key: String,
    pub start_index: i64,
    pub end_index: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataPageData {
    pub canvases: Vec<AppDataCanvas>,
    #[serde(rename = "activeCanvasId")]
    pub active_canvas_id: Option<String>,
    #[serde(rename = "databaseFileName")]
    pub database_file_name: String,
    #[serde(rename = "backupSettings")]
    pub backup_settings: AppDataBackupSettings,
    #[serde(rename = "backupStatus")]
    pub backup_status: AppDataBackupStatus,
    #[serde(rename = "backupDirectoryConfigurable")]
    pub backup_directory_configurable: bool,
    pub nodes: Vec<AppDataNode>,
    pub edges: Vec<AppDataEdge>,
    pub topics: Vec<AppDataTopic>,
    pub tags: Vec<AppDataTagSummary>,
    pub entities: Vec<AppDataEntity>,
    #[serde(rename = "entityMentions")]
    pub entity_mentions: Vec<AppDataEntityMention>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataTagSummary {
    pub id: String,
    pub name: String,
    pub color: String,
    pub node_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataLoadEntities {
    pub entities: Vec<AppDataEntity>,
    pub mentions: Vec<AppDataEntityMention>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataCreateCanvasResult {
    pub success: bool,
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataRenameCanvasResult {
    pub success: bool,
    pub id: String,
    pub name: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataDeleteResult {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataCreateNodeResult {
    pub success: bool,
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataUpdateNodeResult {
    pub success: bool,
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataBulkUpdateResult {
    pub success: bool,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataCreateEdgeResult {
    pub success: bool,
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataPasteGraphResult {
    pub success: bool,
    #[serde(rename = "insertedNodes")]
    pub inserted_nodes: Vec<AppDataInsertNode>,
    #[serde(rename = "insertedEdges")]
    pub inserted_edges: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataInsertNode {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataImportResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataBackupSettings {
    #[serde(rename = "backupDirectoryPath")]
    pub backup_directory_path: String,
    #[serde(rename = "backupIntervalMinutes")]
    pub backup_interval_minutes: u32,
    #[serde(rename = "backupRetentionCount")]
    pub backup_retention_count: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataBackupStatus {
    #[serde(rename = "latestBackupFileName")]
    pub latest_backup_file_name: Option<String>,
    #[serde(rename = "latestBackupCreatedAt")]
    pub latest_backup_created_at: Option<i64>,
    #[serde(rename = "backupCount")]
    pub backup_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppDataDatabaseSettings {
    #[serde(rename = "databaseFileName")]
    pub database_file_name: String,
}

#[derive(Debug, Clone)]
struct NodeEntitySource {
    id: String,
    title: String,
    body: String,
    is_entity: i64,
}

#[derive(Debug, Clone)]
struct EntitySeed {
    id: String,
    canvas_id: String,
    title: String,
    title_key: String,
    primary_node_id: Option<String>,
    created_at: i64,
}

#[derive(Debug, Clone)]
struct EntityMentionSeed {
    title: String,
    title_key: String,
    reference_text: String,
    start_index: i64,
    end_index: i64,
}

#[derive(Debug, Clone)]
struct NodeTitleSource {
    id: String,
    title: String,
}

#[derive(Debug, Clone)]
struct TopicTitleSource {
    id: String,
    title: String,
}

#[derive(Debug, Deserialize)]
struct CanvasCreateInput {
    id: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseSettingsInput {
    database_file_name: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DatabaseSettingsFile {
    database_file_name: Option<String>,
    backup_directory_path: Option<String>,
    backup_interval_minutes: Option<u32>,
    backup_retention_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupSettingsInput {
    backup_directory_path: String,
    backup_interval_minutes: u32,
    backup_retention_count: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupDirectoryPickerInput {
    default_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CanvasRenameInput {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct IdInput {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeCreateInput {
    id: Option<String>,
    canvas_id: String,
    title: Option<String>,
    body: Option<String>,
    is_entity: Option<bool>,
    tags: Option<Vec<String>>,
    x: Option<f64>,
    y: Option<f64>,
    collapsed: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeUpdateInput {
    id: String,
    title: Option<String>,
    body: Option<String>,
    is_entity: Option<bool>,
    x: Option<f64>,
    y: Option<f64>,
    collapsed: Option<i64>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TopicCreateInput {
    id: Option<String>,
    canvas_id: String,
    title: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TopicUpdateInput {
    id: String,
    title: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BulkTagUpdateInput {
    nodes: Vec<BulkTagUpdateNodeInput>,
}

#[derive(Debug, Deserialize)]
struct BulkTagUpdateNodeInput {
    id: String,
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BulkPositionUpdateInput {
    nodes: Vec<BulkPositionNodeInput>,
}

#[derive(Debug, Deserialize)]
struct BulkPositionNodeInput {
    id: String,
    x: f64,
    y: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EdgeCreateInput {
    id: Option<String>,
    canvas_id: String,
    source: String,
    target: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadCanvasInput {
    canvas_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchNodesInput {
    canvas_id: Option<String>,
    query: String,
    tag: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphFragmentInput {
    action: String,
    canvas_id: Option<String>,
    nodes: Option<Vec<serde_json::Value>>,
    edges: Option<Vec<serde_json::Value>>,
    node_ids: Option<Vec<String>>,
    edge_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GraphFragmentDeletionResult {
    success: bool,
    removed_nodes: usize,
    removed_edges: usize,
}

fn create_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn is_valid_database_file_name(file_name: &str) -> bool {
    let trimmed = file_name.trim();

    !trimmed.is_empty()
        && trimmed != "."
        && trimmed != ".."
        && !trimmed.contains('/')
        && !trimmed.contains('\\')
        && !trimmed.contains('\0')
}

fn is_valid_backup_directory_path(path: &str) -> bool {
    !path.trim().is_empty() && !path.contains('\0')
}

fn database_settings_path(app: &AppHandle) -> DbResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

    Ok(dir.join("mindmap.config.json"))
}

fn read_database_settings(app: &AppHandle) -> DbResult<DatabaseSettingsFile> {
    let path = database_settings_path(app)?;

    let defaults = DatabaseSettingsFile {
        database_file_name: Some("mindmap.db".to_string()),
        backup_directory_path: Some("mindmap-backups".to_string()),
        backup_interval_minutes: Some(10),
        backup_retention_count: Some(2),
    };

    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<DatabaseSettingsFile>(&contents) {
            let file_name = settings
                .database_file_name
                .as_deref()
                .map(str::trim)
                .filter(|value| is_valid_database_file_name(value))
                .map(str::to_string)
                .or_else(|| defaults.database_file_name.clone());
            let backup_directory_path = settings
                .backup_directory_path
                .as_deref()
                .map(str::trim)
                .filter(|value| is_valid_backup_directory_path(value))
                .map(str::to_string)
                .or_else(|| defaults.backup_directory_path.clone());
            let backup_interval_minutes = settings
                .backup_interval_minutes
                .filter(|value| *value >= 1)
                .or(defaults.backup_interval_minutes);
            let backup_retention_count = settings
                .backup_retention_count
                .filter(|value| *value >= 1)
                .or(defaults.backup_retention_count);

            return Ok(DatabaseSettingsFile {
                database_file_name: file_name,
                backup_directory_path,
                backup_interval_minutes,
                backup_retention_count,
            });
        }
    }

    Ok(defaults)
}

fn persist_database_settings(app: &AppHandle, settings: &DatabaseSettingsFile) -> DbResult<()> {
    let path = database_settings_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Failed to resolve database settings directory.".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create database settings directory: {error}"))?;

    let contents = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Failed to serialize database settings: {error}"))?;

    fs::write(&path, format!("{contents}\n"))
        .map_err(|error| format!("Failed to write database settings: {error}"))?;
    Ok(())
}

fn read_database_file_name(app: &AppHandle) -> DbResult<String> {
    Ok(read_database_settings(app)?
        .database_file_name
        .unwrap_or_else(|| "mindmap.db".to_string()))
}

fn read_backup_settings(app: &AppHandle) -> DbResult<AppDataBackupSettings> {
    let settings = read_database_settings(app)?;

    Ok(AppDataBackupSettings {
        backup_directory_path: settings
            .backup_directory_path
            .unwrap_or_else(|| "mindmap-backups".to_string()),
        backup_interval_minutes: settings.backup_interval_minutes.unwrap_or(10),
        backup_retention_count: settings.backup_retention_count.unwrap_or(2),
    })
}

fn persist_database_file_name(app: &AppHandle, file_name: &str) -> DbResult<()> {
    let mut settings = read_database_settings(app)?;
    settings.database_file_name = Some(file_name.to_string());
    persist_database_settings(app, &settings)
}

fn persist_backup_settings(app: &AppHandle, settings: &AppDataBackupSettings) -> DbResult<()> {
    let mut file_settings = read_database_settings(app)?;
    file_settings.backup_directory_path = Some(settings.backup_directory_path.clone());
    file_settings.backup_interval_minutes = Some(settings.backup_interval_minutes);
    file_settings.backup_retention_count = Some(settings.backup_retention_count);
    persist_database_settings(app, &file_settings)
}

fn db_path(app: &AppHandle) -> DbResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

    Ok(dir.join(read_database_file_name(app)?))
}

#[derive(Debug, Clone)]
struct BackupSnapshotInfo {
    file_name: String,
    file_path: PathBuf,
    created_at: i64,
}

fn backup_directory_path(app: &AppHandle) -> DbResult<PathBuf> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let settings = read_backup_settings(app)?;

    Ok(resolve_configured_path(
        &base_dir,
        &settings.backup_directory_path,
    ))
}

fn backup_file_name() -> String {
    format!("mindmap-backup-{}-{}.db", now(), create_id())
}

fn list_backup_snapshots(app: &AppHandle) -> DbResult<Vec<BackupSnapshotInfo>> {
    let directory = backup_directory_path(app)?;
    let mut snapshots = Vec::new();

    if !directory.exists() {
        return Ok(snapshots);
    }

    let entries = fs::read_dir(&directory)
        .map_err(|error| format!("Failed to read backup directory: {error}"))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("Failed to read backup entry: {error}"))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if !path.is_file()
            || !file_name.starts_with("mindmap-backup-")
            || !file_name.ends_with(".db")
        {
            continue;
        }

        let metadata = fs::metadata(&path)
            .map_err(|error| format!("Failed to inspect backup snapshot: {error}"))?;
        let modified = metadata
            .modified()
            .map_err(|error| format!("Failed to inspect backup snapshot: {error}"))?;
        let created_at = modified
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        snapshots.push(BackupSnapshotInfo {
            file_name,
            file_path: path,
            created_at,
        });
    }

    snapshots.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(snapshots)
}

fn backup_status(app: &AppHandle) -> DbResult<AppDataBackupStatus> {
    let snapshots = list_backup_snapshots(app)?;
    let latest = snapshots.first();

    Ok(AppDataBackupStatus {
        latest_backup_file_name: latest.map(|snapshot| snapshot.file_name.clone()),
        latest_backup_created_at: latest.map(|snapshot| snapshot.created_at),
        backup_count: snapshots.len(),
    })
}

fn prune_backup_snapshots(app: &AppHandle, retention_count: u32) -> DbResult<()> {
    let snapshots = list_backup_snapshots(app)?;
    for snapshot in snapshots.into_iter().skip(retention_count as usize) {
        let _ = fs::remove_file(snapshot.file_path);
    }

    Ok(())
}

fn backup_database_to_path(source: &Connection, backup_path: &Path) -> DbResult<()> {
    if let Some(parent) = backup_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create backup directory: {error}"))?;
    }

    let mut destination = Connection::open(backup_path)
        .map_err(|error| format!("Failed to open backup snapshot: {error}"))?;
    let backup = Backup::new(source, &mut destination)
        .map_err(|error| format!("Failed to create backup snapshot: {error}"))?;
    backup
        .run_to_completion(5, Duration::from_millis(250), None)
        .map_err(|error| format!("Failed to create backup snapshot: {error}"))?;
    Ok(())
}

fn create_backup_snapshot_for_app(app: &AppHandle) -> DbResult<AppDataBackupStatus> {
    let settings = read_backup_settings(app)?;
    let source_path = db_path(app)?;
    let source = open_database(&source_path)?;
    init_schema(&source)?;

    let directory = backup_directory_path(app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create backup directory: {error}"))?;
    let snapshot_path = directory.join(backup_file_name());

    backup_database_to_path(&source, &snapshot_path)?;
    prune_backup_snapshots(app, settings.backup_retention_count)?;
    backup_status(app)
}

fn restore_latest_backup_for_app(app: &AppHandle) -> DbResult<AppDataBackupStatus> {
    let snapshots = list_backup_snapshots(app)?;
    let latest = snapshots
        .first()
        .ok_or_else(|| "No backup snapshots are available to restore.".to_string())?
        .clone();
    let current_path = db_path(app)?;
    let temp_root = std::env::temp_dir().join(format!("mindmap-restore-{}", create_id()));
    fs::create_dir_all(&temp_root)
        .map_err(|error| format!("Failed to create restore directory: {error}"))?;
    let current_backup_path = temp_root.join("current.db");

    let result = (|| -> DbResult<AppDataBackupStatus> {
        let source = open_database(&current_path)?;
        init_schema(&source)?;
        backup_database_to_path(&source, &current_backup_path)?;
        drop(source);

        if current_path.exists() {
            fs::remove_file(&current_path)
                .map_err(|error| format!("Failed to replace current database: {error}"))?;
        }

        fs::copy(&latest.file_path, &current_path)
            .map_err(|error| format!("Failed to restore backup snapshot: {error}"))?;

        let restored = open_database(&current_path)?;
        init_schema(&restored)?;
        backup_status(app)
    })();

    let cleanup_result = fs::remove_dir_all(&temp_root);

    match result {
        Ok(status) => {
            let _ = cleanup_result;
            Ok(status)
        }
        Err(error) => {
            let _ = fs::copy(&current_backup_path, &current_path);
            let _ = open_database(&current_path).and_then(|connection| init_schema(&connection));
            let _ = cleanup_result;
            Err(error)
        }
    }
}

fn resolve_configured_path(base_dir: &Path, configured_path: &str) -> PathBuf {
    let candidate = Path::new(configured_path);

    if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base_dir.join(candidate)
    }
}

fn open_database(path: &Path) -> DbResult<Connection> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create database directory: {error}"))?;
    }

    let connection =
        Connection::open(path).map_err(|error| format!("Failed to open database: {error}"))?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| format!("Failed to enable foreign keys: {error}"))?;
    Ok(connection)
}

fn with_database<T>(
    app: &AppHandle,
    handler: impl FnOnce(&Connection) -> DbResult<T>,
) -> DbResult<T> {
    let path = db_path(app)?;
    let connection = open_database(&path)?;
    init_schema(&connection)?;
    handler(&connection)
}

fn init_schema(connection: &Connection) -> DbResult<()> {
    connection
        .execute_batch(
            "
        CREATE TABLE IF NOT EXISTS canvases (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER,
          updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS nodes (
          id TEXT PRIMARY KEY,
          canvas_id TEXT,
          title TEXT,
          body TEXT,
          is_entity INTEGER DEFAULT 0,
          x REAL,
          y REAL,
          collapsed INTEGER,
          color TEXT,
          created_at INTEGER,
          updated_at INTEGER,
          FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS edges (
          id TEXT PRIMARY KEY,
          canvas_id TEXT,
          source_node_id TEXT,
          target_node_id TEXT,
          FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS topics (
          id TEXT PRIMARY KEY,
          canvas_id TEXT NOT NULL,
          title TEXT NOT NULL,
          x REAL,
          y REAL,
          width REAL,
          height REAL,
          created_at INTEGER,
          updated_at INTEGER,
          FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS entities (
          id TEXT PRIMARY KEY,
          canvas_id TEXT NOT NULL,
          title TEXT NOT NULL,
          title_key TEXT NOT NULL,
          primary_node_id TEXT,
          created_at INTEGER,
          updated_at INTEGER,
          FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE,
          FOREIGN KEY(primary_node_id) REFERENCES nodes(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS entity_mentions (
          id TEXT PRIMARY KEY,
          canvas_id TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          node_id TEXT NOT NULL,
          reference_text TEXT NOT NULL,
          title TEXT NOT NULL,
          title_key TEXT NOT NULL,
          start_index INTEGER NOT NULL,
          end_index INTEGER NOT NULL,
          created_at INTEGER,
          updated_at INTEGER,
          FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE,
          FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE,
          FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE,
          color TEXT
        );

        CREATE TABLE IF NOT EXISTS node_tags (
          node_id TEXT,
          tag_id TEXT,
          PRIMARY KEY (node_id, tag_id),
          FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE,
          FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_nodes_canvas_created_at
          ON nodes(canvas_id, created_at);

        CREATE INDEX IF NOT EXISTS idx_edges_canvas_id
          ON edges(canvas_id);

        CREATE INDEX IF NOT EXISTS idx_topics_canvas_id
          ON topics(canvas_id);

        CREATE INDEX IF NOT EXISTS idx_node_tags_tag_id
          ON node_tags(tag_id);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_canvas_title_key
          ON entities(canvas_id, title_key);

        CREATE INDEX IF NOT EXISTS idx_entities_canvas_id
          ON entities(canvas_id);

        CREATE INDEX IF NOT EXISTS idx_entities_primary_node_id
          ON entities(primary_node_id);

        CREATE INDEX IF NOT EXISTS idx_entity_mentions_canvas_id
          ON entity_mentions(canvas_id);

        CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_id
          ON entity_mentions(entity_id);

        CREATE INDEX IF NOT EXISTS idx_entity_mentions_node_id
          ON entity_mentions(node_id);
      ",
        )
        .map_err(|error| format!("Failed to initialize schema: {error}"))?;

    let mut has_entity_column = false;
    let mut stmt = connection
        .prepare("PRAGMA table_info(nodes)")
        .map_err(|error| format!("Failed to inspect node columns: {error}"))?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("Failed to inspect node columns: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to inspect node columns: {error}"))?;

    for column in columns {
        if column == "is_entity" {
            has_entity_column = true;
            break;
        }
    }

    if !has_entity_column {
        connection
            .execute_batch("ALTER TABLE nodes ADD COLUMN is_entity INTEGER DEFAULT 0;")
            .map_err(|error| format!("Failed to add node entity column: {error}"))?;
    }

    Ok(())
}

fn normalize_tag_name(raw: &str) -> String {
    raw.trim()
        .trim_start_matches('#')
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_tag_list(tags: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for tag in tags {
        let normalized = normalize_tag_name(tag);
        if normalized.is_empty() || seen.contains(&normalized) {
            continue;
        }

        seen.insert(normalized.clone());
        result.push(normalized);
    }

    result
}

fn search_token_regex() -> &'static regex::Regex {
    static REGEX: OnceLock<regex::Regex> = OnceLock::new();

    REGEX.get_or_init(|| {
        RegexBuilder::new(r"[\p{L}\p{N}]+")
            .unicode(true)
            .build()
            .expect("compile search token regex")
    })
}

fn tokenize_text(value: &str) -> Vec<String> {
    search_token_regex()
        .find_iter(&value.to_lowercase())
        .map(|match_| match_.as_str().to_string())
        .collect()
}

fn tokenize_query(query: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for token in tokenize_text(query.trim()) {
        if seen.insert(token.clone()) {
            result.push(token);
        }
    }

    result
}

#[derive(Debug, Clone)]
struct SearchIndexedNode {
    node: AppDataNode,
    title_tokens: HashSet<String>,
    body_tokens: HashSet<String>,
    tag_tokens: HashSet<String>,
    all_tokens: HashSet<String>,
    normalized_tags: Vec<String>,
}

fn index_search_node(node: AppDataNode) -> SearchIndexedNode {
    let normalized_tags = normalize_tag_list(&node.tags);
    let title_tokens = tokenize_text(&node.title)
        .into_iter()
        .collect::<HashSet<_>>();
    let body_tokens = tokenize_text(&node.body)
        .into_iter()
        .collect::<HashSet<_>>();
    let tag_tokens = normalized_tags
        .iter()
        .flat_map(|tag| tokenize_text(tag))
        .collect::<HashSet<_>>();
    let all_tokens = title_tokens
        .iter()
        .chain(body_tokens.iter())
        .chain(tag_tokens.iter())
        .cloned()
        .collect::<HashSet<_>>();

    SearchIndexedNode {
        node,
        title_tokens,
        body_tokens,
        tag_tokens,
        all_tokens,
        normalized_tags,
    }
}

fn compare_search_nodes(
    left: &SearchIndexedNode,
    right: &SearchIndexedNode,
    left_score: i64,
    right_score: i64,
) -> std::cmp::Ordering {
    right_score
        .cmp(&left_score)
        .then_with(|| left.node.created_at.cmp(&right.node.created_at))
        .then_with(|| left.node.title.cmp(&right.node.title))
        .then_with(|| left.node.id.cmp(&right.node.id))
}

fn score_search_node(
    node: &SearchIndexedNode,
    query_tokens: &[String],
    normalized_tag: &str,
) -> Option<i64> {
    if !normalized_tag.is_empty() && !node.normalized_tags.iter().any(|tag| tag == normalized_tag) {
        return None;
    }

    if query_tokens
        .iter()
        .any(|token| !node.all_tokens.contains(token))
    {
        return None;
    }

    let mut score = 0_i64;

    for token in query_tokens {
        if node.title_tokens.contains(token) {
            score += 300;
        } else if node.tag_tokens.contains(token) {
            score += 200;
        } else if node.body_tokens.contains(token) {
            score += 100;
        }
    }

    if !normalized_tag.is_empty() {
        score += 25;
    }

    if !query_tokens.is_empty()
        && query_tokens
            .iter()
            .all(|token| node.title_tokens.contains(token))
    {
        score += 50;
    }

    Some(score)
}

fn hash_tag_name(value: &str) -> usize {
    let mut hash: i32 = 0;

    for ch in value.chars() {
        hash = hash.wrapping_mul(31).wrapping_add(ch as i32);
    }

    hash.unsigned_abs() as usize
}

fn get_tag_color(tag_name: &str) -> String {
    let normalized = tag_name.trim().to_lowercase();
    if normalized.is_empty() {
        return TAG_PALETTE[0].to_string();
    }

    TAG_PALETTE[hash_tag_name(&normalized) % TAG_PALETTE.len()].to_string()
}

fn normalize_node_title(raw_title: &str) -> String {
    raw_title.trim().to_string()
}

fn canonicalize_node_title(raw_title: &str) -> String {
    normalize_node_title(raw_title).to_lowercase()
}

fn build_used_title_set(nodes: &[NodeTitleSource], exclude_id: Option<&str>) -> HashSet<String> {
    let mut used = HashSet::new();

    for node in nodes {
        if exclude_id == Some(node.id.as_str()) {
            continue;
        }

        let normalized = normalize_node_title(&node.title);
        if normalized.is_empty() {
            continue;
        }

        used.insert(canonicalize_node_title(&normalized));
    }

    used
}

fn has_node_title_conflict(
    nodes: &[NodeTitleSource],
    title: &str,
    exclude_id: Option<&str>,
) -> bool {
    let normalized = normalize_node_title(title);
    if normalized.is_empty() {
        return false;
    }

    build_used_title_set(nodes, exclude_id).contains(&canonicalize_node_title(&normalized))
}

struct NodeTitleAllocator {
    used_titles: HashSet<String>,
}

impl NodeTitleAllocator {
    fn new(nodes: &[NodeTitleSource], exclude_id: Option<&str>) -> Self {
        Self {
            used_titles: build_used_title_set(nodes, exclude_id),
        }
    }

    fn has_title(&self, title: &str) -> bool {
        let normalized = normalize_node_title(title);
        if normalized.is_empty() {
            return false;
        }

        self.used_titles
            .contains(&canonicalize_node_title(&normalized))
    }

    fn reserve_title(&mut self, title: &str) {
        let normalized = normalize_node_title(title);
        if !normalized.is_empty() {
            self.used_titles
                .insert(canonicalize_node_title(&normalized));
        }
    }

    fn next_enumerated_title(&mut self, base_title: &str) -> String {
        let normalized_base = {
            let normalized = normalize_node_title(base_title);
            if normalized.is_empty() {
                "Node".to_string()
            } else {
                normalized
            }
        };

        let mut suffix = 1;
        let mut candidate = format!("{normalized_base} {suffix}");
        while self.has_title(&candidate) {
            suffix += 1;
            candidate = format!("{normalized_base} {suffix}");
        }

        self.reserve_title(&candidate);
        candidate
    }

    fn next_copy_title(&mut self, base_title: &str) -> String {
        let normalized_base = normalize_node_title(base_title);
        if normalized_base.is_empty() {
            return self.next_enumerated_title("Node");
        }

        if !self.has_title(&normalized_base) {
            self.reserve_title(&normalized_base);
            return normalized_base;
        }

        let mut suffix = 1;
        let mut candidate = format!("{normalized_base} ({suffix})");
        while self.has_title(&candidate) {
            suffix += 1;
            candidate = format!("{normalized_base} ({suffix})");
        }

        self.reserve_title(&candidate);
        candidate
    }
}

fn resolve_unique_node_title(nodes: &[NodeTitleSource], requested_title: &str) -> String {
    let mut allocator = NodeTitleAllocator::new(nodes, None);
    let normalized = normalize_node_title(requested_title);

    if normalized.is_empty() {
        allocator.next_enumerated_title("Node")
    } else {
        allocator.next_copy_title(&normalized)
    }
}

fn normalize_topic_title(raw_title: &str) -> String {
    raw_title.trim().to_string()
}

fn canonicalize_topic_title(raw_title: &str) -> String {
    normalize_topic_title(raw_title).to_lowercase()
}

fn build_used_topic_title_set(
    topics: &[TopicTitleSource],
    exclude_id: Option<&str>,
) -> HashSet<String> {
    let mut used = HashSet::new();

    for topic in topics {
        if exclude_id == Some(topic.id.as_str()) {
            continue;
        }

        let normalized = normalize_topic_title(&topic.title);
        if normalized.is_empty() {
            continue;
        }

        used.insert(canonicalize_topic_title(&normalized));
    }

    used
}

fn has_topic_title_conflict(
    topics: &[TopicTitleSource],
    title: &str,
    exclude_id: Option<&str>,
) -> bool {
    let normalized = normalize_topic_title(title);
    if normalized.is_empty() {
        return false;
    }

    build_used_topic_title_set(topics, exclude_id).contains(&canonicalize_topic_title(&normalized))
}

struct TopicTitleAllocator {
    used_titles: HashSet<String>,
}

impl TopicTitleAllocator {
    fn new(topics: &[TopicTitleSource], exclude_id: Option<&str>) -> Self {
        Self {
            used_titles: build_used_topic_title_set(topics, exclude_id),
        }
    }

    fn has_title(&self, title: &str) -> bool {
        let normalized = normalize_topic_title(title);
        if normalized.is_empty() {
            return false;
        }

        self.used_titles
            .contains(&canonicalize_topic_title(&normalized))
    }

    fn reserve_title(&mut self, title: &str) {
        let normalized = normalize_topic_title(title);
        if !normalized.is_empty() {
            self.used_titles
                .insert(canonicalize_topic_title(&normalized));
        }
    }

    fn next_enumerated_title(&mut self, base_title: &str) -> String {
        let normalized_base = {
            let normalized = normalize_topic_title(base_title);
            if normalized.is_empty() {
                "Topic".to_string()
            } else {
                normalized
            }
        };

        let mut suffix = 1;
        let mut candidate = format!("{normalized_base} {suffix}");
        while self.has_title(&candidate) {
            suffix += 1;
            candidate = format!("{normalized_base} {suffix}");
        }

        self.reserve_title(&candidate);
        candidate
    }

    fn next_copy_title(&mut self, base_title: &str) -> String {
        let normalized_base = normalize_topic_title(base_title);
        if normalized_base.is_empty() {
            return self.next_enumerated_title("Topic");
        }

        if !self.has_title(&normalized_base) {
            self.reserve_title(&normalized_base);
            return normalized_base;
        }

        let mut suffix = 1;
        let mut candidate = format!("{normalized_base} ({suffix})");
        while self.has_title(&candidate) {
            suffix += 1;
            candidate = format!("{normalized_base} ({suffix})");
        }

        self.reserve_title(&candidate);
        candidate
    }
}

fn resolve_unique_topic_title(topics: &[TopicTitleSource], requested_title: &str) -> String {
    let mut allocator = TopicTitleAllocator::new(topics, None);
    let normalized = normalize_topic_title(requested_title);

    if normalized.is_empty() {
        allocator.next_enumerated_title("Topic")
    } else {
        allocator.next_copy_title(&normalized)
    }
}

fn replace_entity_references(body: &str, from_title: &str, to_title: &str) -> String {
    let from = normalize_node_title(from_title);
    let to = normalize_node_title(to_title);

    if body.is_empty() || from.is_empty() || to.is_empty() {
        return body.to_string();
    }

    let pattern = format!(r"\[\[\s*{}\s*\]\]", regex::escape(&from));
    let regex = RegexBuilder::new(&pattern)
        .case_insensitive(true)
        .build()
        .unwrap_or_else(|_| panic!("Failed to build entity reference regex"));

    regex.replace_all(body, format!("[[{to}]]")).into_owned()
}

fn extract_entity_references(body: &str) -> Vec<EntityMentionSeed> {
    if body.is_empty() {
        return Vec::new();
    }

    let mut results = Vec::new();
    let mut index = 0;

    while let Some(start) = body[index..].find("[[") {
        let start_index = index + start;
        let search_from = start_index + 2;
        let Some(close) = body[search_from..].find("]]") else {
            break;
        };
        let end_index = search_from + close;
        let title = normalize_node_title(&body[search_from..end_index]);

        if !title.is_empty() {
            results.push(EntityMentionSeed {
                title: title.clone(),
                title_key: canonicalize_node_title(&title),
                reference_text: body[start_index..end_index + 2].to_string(),
                start_index: start_index as i64,
                end_index: (end_index + 2) as i64,
            });
        }

        index = end_index + 2;
    }

    results
}

fn parse_tag_row_ids(connection: &Connection, node_id: &str) -> DbResult<Vec<String>> {
    let mut stmt = connection
        .prepare(
            "
        SELECT t.name
        FROM node_tags nt
        JOIN tags t ON t.id = nt.tag_id
        WHERE nt.node_id = ?
        ORDER BY nt.rowid
      ",
        )
        .map_err(|error| format!("Failed to load node tags: {error}"))?;

    let rows = stmt
        .query_map(params![node_id], |row| row.get::<_, String>(0))
        .map_err(|error| format!("Failed to load node tags: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load node tags: {error}"))?;

    Ok(rows)
}

fn get_or_create_tag_id(connection: &Connection, name: &str) -> DbResult<String> {
    let normalized = normalize_tag_name(name);
    if normalized.is_empty() {
        return Err("Tag name cannot be empty.".to_string());
    }

    let existing = connection
        .query_row(
            "SELECT id, color FROM tags WHERE name = ?",
            params![normalized.as_str()],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()
        .map_err(|error| format!("Failed to query tag: {error}"))?;

    if let Some((id, color)) = existing {
        if color.as_deref().unwrap_or_default().is_empty() {
            connection
                .execute(
                    "UPDATE tags SET color = ? WHERE id = ?",
                    params![get_tag_color(&normalized), id.as_str()],
                )
                .map_err(|error| format!("Failed to update tag color: {error}"))?;
        }
        return Ok(id);
    }

    let id = create_id();
    connection
        .execute(
            "INSERT INTO tags (id, name, color) VALUES (?, ?, ?)",
            params![id.as_str(), normalized.as_str(), get_tag_color(&normalized)],
        )
        .map_err(|error| format!("Failed to create tag: {error}"))?;

    Ok(id)
}

fn replace_node_tags(connection: &Connection, node_id: &str, tags: &[String]) -> DbResult<()> {
    connection
        .execute("DELETE FROM node_tags WHERE node_id = ?", params![node_id])
        .map_err(|error| format!("Failed to clear node tags: {error}"))?;

    for tag in normalize_tag_list(tags) {
        let tag_id = get_or_create_tag_id(connection, &tag)?;
        connection
            .execute(
                "INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)",
                params![node_id, tag_id.as_str()],
            )
            .map_err(|error| format!("Failed to assign node tag: {error}"))?;
    }

    Ok(())
}

fn load_canvases_from_db(connection: &Connection) -> DbResult<Vec<AppDataCanvas>> {
    let mut stmt = connection
        .prepare("SELECT id, name, created_at, updated_at FROM canvases ORDER BY updated_at DESC")
        .map_err(|error| format!("Failed to load canvases: {error}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(AppDataCanvas {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|error| format!("Failed to load canvases: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load canvases: {error}"))?;

    Ok(rows)
}

fn load_nodes_by_canvas_id(connection: &Connection, canvas_id: &str) -> DbResult<Vec<AppDataNode>> {
    let mut stmt = connection
        .prepare(
            "
        SELECT id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
        FROM nodes
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      ",
        )
        .map_err(|error| format!("Failed to load nodes: {error}"))?;

    let mut nodes = stmt
        .query_map(params![canvas_id], |row| {
            Ok(AppDataNode {
                id: row.get(0)?,
                canvas_id: row.get(1)?,
                title: row.get(2)?,
                body: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                is_entity: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                tags: Vec::new(),
                x: row.get::<_, Option<f64>>(5)?.unwrap_or(0.0),
                y: row.get::<_, Option<f64>>(6)?.unwrap_or(0.0),
                collapsed: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| format!("Failed to load nodes: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load nodes: {error}"))?;

    for node in &mut nodes {
        node.tags = parse_tag_row_ids(connection, &node.id)?;
    }

    Ok(nodes)
}

fn load_topics_by_canvas_id(
    connection: &Connection,
    canvas_id: &str,
) -> DbResult<Vec<AppDataTopic>> {
    let mut stmt = connection
        .prepare(
            "
        SELECT id, canvas_id, title, x, y, width, height, created_at, updated_at
        FROM topics
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      ",
        )
        .map_err(|error| format!("Failed to load topics: {error}"))?;

    let rows = stmt
        .query_map(params![canvas_id], |row| {
            Ok(AppDataTopic {
                id: row.get(0)?,
                canvas_id: row.get(1)?,
                title: row.get(2)?,
                x: row.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
                y: row.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                width: row.get::<_, Option<f64>>(5)?.unwrap_or(280.0),
                height: row.get::<_, Option<f64>>(6)?.unwrap_or(180.0),
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|error| format!("Failed to load topics: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load topics: {error}"))?;

    Ok(rows)
}

fn get_node_titles_by_canvas_id(
    connection: &Connection,
    canvas_id: &str,
) -> DbResult<Vec<NodeTitleSource>> {
    let mut stmt = connection
        .prepare(
            "
        SELECT id, title
        FROM nodes
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      ",
        )
        .map_err(|error| format!("Failed to load node titles: {error}"))?;

    let rows = stmt
        .query_map(params![canvas_id], |row| {
            Ok(NodeTitleSource {
                id: row.get(0)?,
                title: row.get(1)?,
            })
        })
        .map_err(|error| format!("Failed to load node titles: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load node titles: {error}"))?;

    Ok(rows)
}

fn get_tags_by_canvas_id(
    connection: &Connection,
    canvas_id: &str,
) -> DbResult<Vec<AppDataTagSummary>> {
    let mut stmt = connection
        .prepare(
            "
        SELECT
          t.id,
          t.name,
          t.color,
          COUNT(nt.node_id) AS node_count
        FROM tags t
        JOIN node_tags nt ON nt.tag_id = t.id
        JOIN nodes n ON n.id = nt.node_id
        WHERE n.canvas_id = ?
        GROUP BY t.id, t.name, t.color
        ORDER BY node_count DESC, t.name ASC
      ",
        )
        .map_err(|error| format!("Failed to load tags: {error}"))?;

    let rows = stmt
        .query_map(params![canvas_id], |row| {
            let name: String = row.get(1)?;
            let color: Option<String> = row.get(2)?;
            Ok(AppDataTagSummary {
                id: row.get(0)?,
                name: name.clone(),
                color: color.unwrap_or_else(|| get_tag_color(&name)),
                node_count: row.get::<_, i64>(3)?,
            })
        })
        .map_err(|error| format!("Failed to load tags: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load tags: {error}"))?;

    Ok(rows)
}

fn search_nodes_by_canvas_id(
    connection: &Connection,
    canvas_id: &str,
    query: &str,
    active_tag: Option<&str>,
) -> DbResult<Vec<AppDataNode>> {
    let normalized_query = query.trim().to_lowercase();
    let normalized_tag = active_tag.map(normalize_tag_name).unwrap_or_default();

    if normalized_query.is_empty() && normalized_tag.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = connection
        .prepare(
            "
        SELECT
          n.id,
          n.canvas_id,
          n.title,
          n.body,
          n.is_entity,
          n.x,
          n.y,
          n.collapsed,
          n.created_at,
          n.updated_at,
          COALESCE((
            SELECT json_group_array(tag_name)
            FROM (
              SELECT t.name AS tag_name
              FROM node_tags nt
              JOIN tags t ON t.id = nt.tag_id
              WHERE nt.node_id = n.id
              ORDER BY nt.rowid
            )
          ), '[]') AS tags
        FROM nodes n
        WHERE n.canvas_id = ?
      ",
        )
        .map_err(|error| format!("Failed to search nodes: {error}"))?;

    let rows = stmt
        .query_map(params![canvas_id], |row| {
            let raw_tags: String = row.get(10)?;
            let tags = serde_json::from_str(&raw_tags).unwrap_or_default();

            Ok(AppDataNode {
                id: row.get(0)?,
                canvas_id: row.get(1)?,
                title: row.get(2)?,
                body: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                is_entity: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                tags,
                x: row.get::<_, Option<f64>>(5)?.unwrap_or(0.0),
                y: row.get::<_, Option<f64>>(6)?.unwrap_or(0.0),
                collapsed: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| format!("Failed to search nodes: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to search nodes: {error}"))?;

    let indexed_rows = rows.into_iter().map(index_search_node).collect::<Vec<_>>();
    let query_tokens = tokenize_query(&normalized_query);

    let mut ranked = indexed_rows
        .into_iter()
        .filter_map(|indexed| {
            score_search_node(&indexed, &query_tokens, &normalized_tag)
                .map(|score| (indexed, score))
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|(left, left_score), (right, right_score)| {
        compare_search_nodes(left, right, *left_score, *right_score)
    });

    Ok(ranked
        .into_iter()
        .map(|(indexed, _)| indexed.node)
        .collect())
}

fn load_edges_by_canvas_id(connection: &Connection, canvas_id: &str) -> DbResult<Vec<AppDataEdge>> {
    let mut stmt = connection
        .prepare(
            "SELECT id, canvas_id, source_node_id, target_node_id FROM edges WHERE canvas_id = ?",
        )
        .map_err(|error| format!("Failed to load edges: {error}"))?;

    let rows = stmt
        .query_map(params![canvas_id], |row| {
            Ok(AppDataEdge {
                id: row.get(0)?,
                canvas_id: row.get(1)?,
                source_node_id: row.get(2)?,
                target_node_id: row.get(3)?,
            })
        })
        .map_err(|error| format!("Failed to load edges: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load edges: {error}"))?;

    Ok(rows)
}

fn load_entities_by_canvas_id(
    connection: &Connection,
    canvas_id: &str,
) -> DbResult<Vec<AppDataEntity>> {
    let mut stmt = connection
        .prepare(
            "
        SELECT
          e.id,
          e.canvas_id,
          e.title,
          e.title_key,
          e.primary_node_id,
          e.created_at,
          e.updated_at,
          COUNT(em.id) AS mention_count
        FROM entities e
        LEFT JOIN entity_mentions em ON em.entity_id = e.id
        WHERE e.canvas_id = ?
        GROUP BY
          e.id,
          e.canvas_id,
          e.title,
          e.title_key,
          e.primary_node_id,
          e.created_at,
          e.updated_at
        ORDER BY e.primary_node_id IS NULL, e.title_key ASC
      ",
        )
        .map_err(|error| format!("Failed to load entities: {error}"))?;

    let rows = stmt
        .query_map(params![canvas_id], |row| {
            Ok(AppDataEntity {
                id: row.get(0)?,
                canvas_id: row.get(1)?,
                title: row.get(2)?,
                title_key: row.get(3)?,
                primary_node_id: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                mention_count: row.get(7)?,
            })
        })
        .map_err(|error| format!("Failed to load entities: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load entities: {error}"))?;

    Ok(rows)
}

fn load_entity_mentions_by_canvas_id(
    connection: &Connection,
    canvas_id: &str,
) -> DbResult<Vec<AppDataEntityMention>> {
    let mut stmt = connection
        .prepare(
            "
        SELECT
          em.id,
          em.canvas_id,
          em.entity_id,
          em.node_id,
          em.reference_text,
          em.title,
          em.title_key,
          em.start_index,
          em.end_index,
          em.created_at,
          em.updated_at
        FROM entity_mentions em
        WHERE em.canvas_id = ?
        ORDER BY em.node_id ASC, em.start_index ASC
      ",
        )
        .map_err(|error| format!("Failed to load entity mentions: {error}"))?;

    let rows = stmt
        .query_map(params![canvas_id], |row| {
            Ok(AppDataEntityMention {
                id: row.get(0)?,
                canvas_id: row.get(1)?,
                entity_id: row.get(2)?,
                node_id: row.get(3)?,
                reference_text: row.get(4)?,
                title: row.get(5)?,
                title_key: row.get(6)?,
                start_index: row.get(7)?,
                end_index: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|error| format!("Failed to load entity mentions: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to load entity mentions: {error}"))?;

    Ok(rows)
}

fn rebuild_entities_for_canvas_id(connection: &Connection, canvas_id: &str) -> DbResult<()> {
    let timestamp = now();
    let mut node_stmt = connection
        .prepare(
            "
        SELECT id, canvas_id, title, body, is_entity
        FROM nodes
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      ",
        )
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;

    let nodes = node_stmt
        .query_map(params![canvas_id], |row| {
            Ok(NodeEntitySource {
                id: row.get(0)?,
                title: row.get(2)?,
                body: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                is_entity: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
            })
        })
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;

    let mut existing_entities_stmt = connection
        .prepare(
            "
        SELECT id, title, title_key, primary_node_id, created_at
        FROM entities
        WHERE canvas_id = ?
      ",
        )
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;
    let existing_entities = existing_entities_stmt
        .query_map(params![canvas_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;

    let existing_entities_by_key = existing_entities
        .into_iter()
        .map(|(id, title, title_key, primary_node_id, created_at)| {
            (
                title_key.clone(),
                EntitySeed {
                    id,
                    canvas_id: canvas_id.to_string(),
                    title,
                    title_key,
                    primary_node_id,
                    created_at,
                },
            )
        })
        .collect::<HashMap<_, _>>();

    let mut node_titles_by_key = HashMap::new();
    let mut entities_by_key = HashMap::new();
    let mut references_by_node_id: HashMap<String, Vec<EntityMentionSeed>> = HashMap::new();

    for node in &nodes {
        if node.is_entity == 0 {
            continue;
        }

        let title = normalize_node_title(&node.title);
        if title.is_empty() {
            continue;
        }

        let title_key = canonicalize_node_title(&title);
        node_titles_by_key.insert(title_key.clone(), node.clone());

        let existing = existing_entities_by_key.get(&title_key);
        entities_by_key.insert(
            title_key.clone(),
            EntitySeed {
                id: existing
                    .map(|entity| entity.id.clone())
                    .unwrap_or_else(create_id),
                canvas_id: canvas_id.to_string(),
                title,
                title_key,
                primary_node_id: Some(node.id.clone()),
                created_at: existing
                    .map(|entity| entity.created_at)
                    .unwrap_or(timestamp),
            },
        );
    }

    for node in &nodes {
        let references = extract_entity_references(&node.body);
        references_by_node_id.insert(node.id.clone(), references.clone());

        for reference in references {
            if entities_by_key.contains_key(&reference.title_key) {
                continue;
            }

            let existing = existing_entities_by_key.get(&reference.title_key);
            entities_by_key.insert(
                reference.title_key.clone(),
                EntitySeed {
                    id: existing
                        .map(|entity| entity.id.clone())
                        .unwrap_or_else(create_id),
                    canvas_id: canvas_id.to_string(),
                    title: reference.title.clone(),
                    title_key: reference.title_key.clone(),
                    primary_node_id: node_titles_by_key
                        .get(&reference.title_key)
                        .map(|node| node.id.clone()),
                    created_at: existing
                        .map(|entity| entity.created_at)
                        .unwrap_or(timestamp),
                },
            );
        }
    }

    connection
        .execute(
            "DELETE FROM entity_mentions WHERE canvas_id = ?",
            params![canvas_id],
        )
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;
    connection
        .execute(
            "DELETE FROM entities WHERE canvas_id = ?",
            params![canvas_id],
        )
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;

    let mut insert_entity = connection
        .prepare(
            "
        INSERT INTO entities (
          id, canvas_id, title, title_key, primary_node_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ",
        )
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;
    let mut insert_mention = connection
        .prepare(
            "
        INSERT INTO entity_mentions (
          id, canvas_id, entity_id, node_id, reference_text, title, title_key,
          start_index, end_index, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ",
        )
        .map_err(|error| format!("Failed to rebuild entities: {error}"))?;

    for entity in entities_by_key.values() {
        insert_entity
            .execute(params![
                entity.id.as_str(),
                entity.canvas_id.as_str(),
                entity.title.as_str(),
                entity.title_key.as_str(),
                entity.primary_node_id.as_deref(),
                entity.created_at,
                timestamp,
            ])
            .map_err(|error| format!("Failed to rebuild entities: {error}"))?;
    }

    for node in &nodes {
        let references = references_by_node_id
            .get(&node.id)
            .cloned()
            .unwrap_or_default();
        for reference in references {
            let Some(entity) = entities_by_key.get(&reference.title_key) else {
                continue;
            };

            insert_mention
                .execute(params![
                    create_id(),
                    canvas_id,
                    entity.id.as_str(),
                    node.id.as_str(),
                    reference.reference_text.as_str(),
                    reference.title.as_str(),
                    reference.title_key.as_str(),
                    reference.start_index,
                    reference.end_index,
                    timestamp,
                    timestamp,
                ])
                .map_err(|error| format!("Failed to rebuild entities: {error}"))?;
        }
    }

    Ok(())
}

fn get_initial_page_data(connection: &Connection) -> DbResult<AppDataPageData> {
    let canvases = load_canvases_from_db(connection)?;
    let active_canvas_id = canvases.first().map(|canvas| canvas.id.clone());

    if let Some(canvas_id) = active_canvas_id.clone() {
        Ok(AppDataPageData {
            canvases,
            active_canvas_id,
            database_file_name: String::new(),
            backup_settings: AppDataBackupSettings {
                backup_directory_path: "mindmap-backups".to_string(),
                backup_interval_minutes: 10,
                backup_retention_count: 2,
            },
            backup_status: AppDataBackupStatus {
                latest_backup_file_name: None,
                latest_backup_created_at: None,
                backup_count: 0,
            },
            backup_directory_configurable: true,
            nodes: load_nodes_by_canvas_id(connection, &canvas_id)?,
            edges: load_edges_by_canvas_id(connection, &canvas_id)?,
            topics: load_topics_by_canvas_id(connection, &canvas_id)?,
            tags: get_tags_by_canvas_id(connection, &canvas_id)?,
            entities: load_entities_by_canvas_id(connection, &canvas_id)?,
            entity_mentions: load_entity_mentions_by_canvas_id(connection, &canvas_id)?,
        })
    } else {
        Ok(AppDataPageData {
            canvases,
            active_canvas_id,
            database_file_name: String::new(),
            backup_settings: AppDataBackupSettings {
                backup_directory_path: "mindmap-backups".to_string(),
                backup_interval_minutes: 10,
                backup_retention_count: 2,
            },
            backup_status: AppDataBackupStatus {
                latest_backup_file_name: None,
                latest_backup_created_at: None,
                backup_count: 0,
            },
            backup_directory_configurable: true,
            nodes: Vec::new(),
            edges: Vec::new(),
            topics: Vec::new(),
            tags: Vec::new(),
            entities: Vec::new(),
            entity_mentions: Vec::new(),
        })
    }
}

#[tauri::command]
fn load_initial_page_data(app: AppHandle) -> DbResult<AppDataPageData> {
    with_database(&app, |connection| {
        let mut page_data = get_initial_page_data(connection)?;
        page_data.database_file_name = read_database_file_name(&app)?;
        page_data.backup_settings = read_backup_settings(&app)?;
        page_data.backup_status = backup_status(&app)?;
        Ok(page_data)
    })
}

#[tauri::command]
async fn update_database_settings(
    app: AppHandle,
    input: DatabaseSettingsInput,
) -> DbResult<AppDataDatabaseSettings> {
    let normalized = input.database_file_name.trim();

    if !is_valid_database_file_name(normalized) {
        return Err("Database file name must be a simple file name.".to_string());
    }

    let current_path = db_path(&app)?;
    let next_path = current_path
        .parent()
        .ok_or_else(|| "Failed to resolve database directory.".to_string())?
        .join(normalized);

    if current_path == next_path {
        persist_database_file_name(&app, normalized)?;
        return Ok(AppDataDatabaseSettings {
            database_file_name: normalized.to_string(),
        });
    }

    if next_path.exists() {
        return Err(format!("Database file \"{}\" already exists.", normalized));
    }

    let current_existed = current_path.exists();
    let mut moved = false;

    if current_existed {
        fs::rename(&current_path, &next_path)
            .map_err(|error| format!("Failed to rename database file: {error}"))?;
        moved = true;
    }

    if let Err(error) = persist_database_file_name(&app, normalized) {
        if moved {
            let _ = fs::rename(&next_path, &current_path);
        }

        return Err(error);
    }

    Ok(AppDataDatabaseSettings {
        database_file_name: normalized.to_string(),
    })
}

#[tauri::command]
async fn update_backup_settings(
    app: AppHandle,
    input: BackupSettingsInput,
) -> DbResult<AppDataBackupSettings> {
    if !is_valid_backup_directory_path(&input.backup_directory_path) {
        return Err("Backup folder path is required.".to_string());
    }

    if input.backup_interval_minutes < 1 {
        return Err("Backup interval must be at least 1 minute.".to_string());
    }

    if input.backup_retention_count < 1 {
        return Err("Backup retention must be at least 1 snapshot.".to_string());
    }

    let settings = AppDataBackupSettings {
        backup_directory_path: input.backup_directory_path.trim().to_string(),
        backup_interval_minutes: input.backup_interval_minutes,
        backup_retention_count: input.backup_retention_count,
    };
    persist_backup_settings(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
fn pick_backup_directory(input: Option<BackupDirectoryPickerInput>) -> Option<String> {
    let default_path = input
        .and_then(|value| value.default_path)
        .filter(|value| !value.trim().is_empty());
    let mut dialog = FileDialog::new();

    if let Some(path) = default_path {
        dialog = dialog.set_directory(path);
    }

    dialog.pick_folder().map(|path| path.display().to_string())
}

#[tauri::command]
fn create_backup_snapshot(app: AppHandle) -> DbResult<AppDataBackupStatus> {
    create_backup_snapshot_for_app(&app)
}

#[tauri::command]
fn restore_latest_backup(app: AppHandle) -> DbResult<AppDataBackupStatus> {
    restore_latest_backup_for_app(&app)
}

#[tauri::command]
fn load_canvases(app: AppHandle) -> DbResult<Vec<AppDataCanvas>> {
    with_database(&app, load_canvases_from_db)
}

#[tauri::command]
fn create_canvas(app: AppHandle, input: CanvasCreateInput) -> DbResult<AppDataCreateCanvasResult> {
    with_database(&app, |connection| {
        let id = input
            .id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string())
            .unwrap_or_else(create_id);
        let name = input
            .name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string())
            .unwrap_or_else(|| "New Canvas".to_string());
        let timestamp = now();

        connection
            .execute(
                "INSERT INTO canvases (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                params![id.as_str(), name.as_str(), timestamp, timestamp],
            )
            .map_err(|error| format!("Failed to create canvas: {error}"))?;

        Ok(AppDataCreateCanvasResult {
            success: true,
            id,
            name,
        })
    })
}

#[tauri::command]
fn rename_canvas(app: AppHandle, input: CanvasRenameInput) -> DbResult<AppDataRenameCanvasResult> {
    with_database(&app, |connection| {
        let trimmed = input.name.trim();
        if trimmed.is_empty() {
            return Err("Canvas name cannot be empty.".to_string());
        }

        let timestamp = now();
        connection
            .execute(
                "UPDATE canvases SET name = ?, updated_at = ? WHERE id = ?",
                params![trimmed, timestamp, input.id.as_str()],
            )
            .map_err(|error| format!("Failed to rename canvas: {error}"))?;

        Ok(AppDataRenameCanvasResult {
            success: true,
            id: input.id,
            name: trimmed.to_string(),
            updated_at: timestamp,
        })
    })
}

#[tauri::command]
fn delete_canvas(app: AppHandle, input: IdInput) -> DbResult<AppDataDeleteResult> {
    with_database(&app, |connection| {
        connection
            .execute(
                "DELETE FROM canvases WHERE id = ?",
                params![input.id.as_str()],
            )
            .map_err(|error| format!("Failed to delete canvas: {error}"))?;

        Ok(AppDataDeleteResult { success: true })
    })
}

#[tauri::command]
fn load_nodes(app: AppHandle, input: LoadCanvasInput) -> DbResult<Vec<AppDataNode>> {
    with_database(&app, |connection| {
        load_nodes_by_canvas_id(connection, &input.canvas_id)
    })
}

#[tauri::command]
fn load_topics(app: AppHandle, input: LoadCanvasInput) -> DbResult<Vec<AppDataTopic>> {
    with_database(&app, |connection| {
        load_topics_by_canvas_id(connection, &input.canvas_id)
    })
}

#[tauri::command]
fn create_topic(app: AppHandle, input: TopicCreateInput) -> DbResult<AppDataCreateNodeResult> {
    with_database(&app, |connection| {
        let id = input
            .id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string())
            .unwrap_or_else(create_id);
        let topic_titles = load_topics_by_canvas_id(connection, &input.canvas_id)?
            .into_iter()
            .map(|topic| TopicTitleSource {
                id: topic.id,
                title: topic.title,
            })
            .collect::<Vec<_>>();
        let title = resolve_unique_topic_title(&topic_titles, input.title.as_deref().unwrap_or(""));
        let x = input.x.unwrap_or(0.0);
        let y = input.y.unwrap_or(0.0);
        let width = input.width.unwrap_or(280.0);
        let height = input.height.unwrap_or(180.0);
        let timestamp = now();

        connection
            .execute(
                "
          INSERT INTO topics (
            id, canvas_id, title, x, y, width, height, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ",
                params![
                    id.as_str(),
                    input.canvas_id.as_str(),
                    title.as_str(),
                    x,
                    y,
                    width,
                    height,
                    timestamp,
                    timestamp,
                ],
            )
            .map_err(|error| format!("Failed to create topic: {error}"))?;

        Ok(AppDataCreateNodeResult {
            success: true,
            id,
            title,
        })
    })
}

#[tauri::command]
fn update_topic(app: AppHandle, input: TopicUpdateInput) -> DbResult<AppDataUpdateNodeResult> {
    with_database(&app, |connection| {
        let topic = connection
            .query_row(
                "SELECT id, canvas_id, title FROM topics WHERE id = ?",
                params![input.id.as_str()],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .optional()
            .map_err(|error| format!("Failed to load topic: {error}"))?;

        let Some((_, canvas_id, _existing_title)) = topic else {
            return Err("Missing id".to_string());
        };

        if let Some(title) = input.title.as_deref() {
            let normalized = normalize_topic_title(title);
            if normalized.is_empty() {
                return Err("Topic title cannot be empty.".to_string());
            }

            let current_topics = load_topics_by_canvas_id(connection, &canvas_id)?
                .into_iter()
                .map(|topic| TopicTitleSource {
                    id: topic.id,
                    title: topic.title,
                })
                .collect::<Vec<_>>();

            if has_topic_title_conflict(&current_topics, &normalized, Some(input.id.as_str())) {
                return Err(format!(
                    "A topic titled \"{}\" already exists in this canvas.",
                    normalized
                ));
            }
        }

        connection
            .execute(
                "
          UPDATE topics
          SET
            title = COALESCE(?, title),
            x = COALESCE(?, x),
            y = COALESCE(?, y),
            width = COALESCE(?, width),
            height = COALESCE(?, height),
            updated_at = ?
          WHERE id = ?
        ",
                params![
                    input.title.as_deref(),
                    input.x,
                    input.y,
                    input.width,
                    input.height,
                    now(),
                    input.id.as_str(),
                ],
            )
            .map_err(|error| format!("Failed to update topic: {error}"))?;

        Ok(AppDataUpdateNodeResult {
            success: true,
            id: input.id,
        })
    })
}

#[tauri::command]
fn delete_topic(app: AppHandle, input: IdInput) -> DbResult<AppDataDeleteResult> {
    with_database(&app, |connection| {
        connection
            .execute("DELETE FROM topics WHERE id = ?", params![input.id.as_str()])
            .map_err(|error| format!("Failed to delete topic: {error}"))?;

        Ok(AppDataDeleteResult { success: true })
    })
}

#[tauri::command]
fn create_node(app: AppHandle, input: NodeCreateInput) -> DbResult<AppDataCreateNodeResult> {
    with_database(&app, |connection| {
        let id = input
            .id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string())
            .unwrap_or_else(create_id);
        let titles = get_node_titles_by_canvas_id(connection, &input.canvas_id)?;
        let title = resolve_unique_node_title(&titles, input.title.as_deref().unwrap_or(""));
        let body = input.body.unwrap_or_default();
        let is_entity = input.is_entity.unwrap_or(false);
        let tags = normalize_tag_list(&input.tags.unwrap_or_default());
        let x = input.x.unwrap_or(0.0);
        let y = input.y.unwrap_or(0.0);
        let collapsed = input.collapsed.unwrap_or(0);
        let timestamp = now();

        connection
            .execute(
                "
          INSERT INTO nodes (
            id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ",
                params![
                    id.as_str(),
                    input.canvas_id.as_str(),
                    title.as_str(),
                    body.as_str(),
                    if is_entity { 1 } else { 0 },
                    x,
                    y,
                    collapsed,
                    timestamp,
                    timestamp,
                ],
            )
            .map_err(|error| format!("Failed to create node: {error}"))?;

        if !tags.is_empty() {
            replace_node_tags(connection, &id, &tags)?;
        }

        rebuild_entities_for_canvas_id(connection, &input.canvas_id)?;

        Ok(AppDataCreateNodeResult {
            success: true,
            id,
            title,
        })
    })
}

#[tauri::command]
fn update_node(app: AppHandle, input: NodeUpdateInput) -> DbResult<AppDataUpdateNodeResult> {
    with_database(&app, |connection| {
        let node = connection
            .query_row(
                "SELECT id, canvas_id, title, body FROM nodes WHERE id = ?",
                params![input.id.as_str()],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    ))
                },
            )
            .optional()
            .map_err(|error| format!("Failed to load node: {error}"))?;

        let Some((_, canvas_id, existing_title, existing_body)) = node else {
            return Err("Missing id".to_string());
        };

        if let Some(title) = input.title.as_deref() {
            if normalize_node_title(title).is_empty() {
                return Err("Node title cannot be empty.".to_string());
            }

            let current_titles = get_node_titles_by_canvas_id(connection, &canvas_id)?;
            if has_node_title_conflict(&current_titles, title, Some(input.id.as_str())) {
                return Err(format!(
                    "A node titled \"{}\" already exists in this canvas.",
                    normalize_node_title(title)
                ));
            }
        }

        let has_title_change = input
            .title
            .as_deref()
            .map(normalize_node_title)
            .map(|title| title != normalize_node_title(&existing_title))
            .unwrap_or(false);
        let title_rewrite_source = existing_title.clone();
        let title_rewrite_target = input
            .title
            .clone()
            .unwrap_or_else(|| existing_title.clone());
        let rewritten_current_body = replace_entity_references(
            input.body.as_deref().unwrap_or(&existing_body),
            &title_rewrite_source,
            &title_rewrite_target,
        );
        let next_body = if input.body.is_some() || has_title_change {
            Some(rewritten_current_body.clone())
        } else {
            None
        };

        let rewritten_body_updates = {
            let mut stmt = connection
                .prepare("SELECT id, body FROM nodes WHERE canvas_id = ?")
                .map_err(|error| format!("Failed to prepare node rewrite query: {error}"))?;
            let rows = stmt
                .query_map(params![canvas_id.as_str()], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    ))
                })
                .map_err(|error| format!("Failed to read node bodies: {error}"))?;

            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Failed to read node bodies: {error}"))?
        };

        for (node_id, original_body) in rewritten_body_updates {
            let next_entry_body = if node_id == input.id {
                rewritten_current_body.clone()
            } else if has_title_change {
                replace_entity_references(
                    &original_body,
                    &title_rewrite_source,
                    &title_rewrite_target,
                )
            } else {
                original_body.clone()
            };

            if next_entry_body != original_body {
                connection
                    .execute(
                        "UPDATE nodes SET body = ?, updated_at = ? WHERE id = ?",
                        params![next_entry_body, now(), node_id],
                    )
                    .map_err(|error| format!("Failed to rewrite node body: {error}"))?;
            }
        }

        connection
            .execute(
                "
          UPDATE nodes
          SET
            title = COALESCE(?, title),
            body = COALESCE(?, body),
            is_entity = COALESCE(?, is_entity),
            x = COALESCE(?, x),
            y = COALESCE(?, y),
            collapsed = COALESCE(?, collapsed),
            updated_at = ?
          WHERE id = ?
        ",
                params![
                    input.title.as_deref(),
                    next_body.as_deref(),
                    input.is_entity.map(|value| if value { 1 } else { 0 }),
                    input.x,
                    input.y,
                    input.collapsed,
                    now(),
                    input.id.as_str(),
                ],
            )
            .map_err(|error| format!("Failed to update node: {error}"))?;

        if let Some(tags) = input.tags.as_ref() {
            replace_node_tags(connection, &input.id, tags)?;
        }

        rebuild_entities_for_canvas_id(connection, &canvas_id)?;

        Ok(AppDataUpdateNodeResult {
            success: true,
            id: input.id,
        })
    })
}

#[tauri::command]
fn delete_node(app: AppHandle, input: IdInput) -> DbResult<AppDataDeleteResult> {
    with_database(&app, |connection| {
        let canvas_id = connection
            .query_row(
                "SELECT canvas_id FROM nodes WHERE id = ?",
                params![input.id.as_str()],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|error| format!("Failed to load node: {error}"))?
            .flatten();

        connection
            .execute("DELETE FROM nodes WHERE id = ?", params![input.id.as_str()])
            .map_err(|error| format!("Failed to delete node: {error}"))?;

        if let Some(canvas_id) = canvas_id {
            rebuild_entities_for_canvas_id(connection, &canvas_id)?;
        }

        Ok(AppDataDeleteResult { success: true })
    })
}

#[tauri::command]
fn bulk_update_node_tags(
    app: AppHandle,
    input: BulkTagUpdateInput,
) -> DbResult<AppDataBulkUpdateResult> {
    with_database(&app, |connection| {
        for update in &input.nodes {
            connection
                .execute(
                    "UPDATE nodes SET updated_at = ? WHERE id = ?",
                    params![now(), update.id.as_str()],
                )
                .map_err(|error| format!("Failed to update node timestamp: {error}"))?;
            replace_node_tags(connection, &update.id, &update.tags)?;
        }

        Ok(AppDataBulkUpdateResult {
            success: true,
            count: input.nodes.len(),
        })
    })
}

#[tauri::command]
fn bulk_update_node_positions(
    app: AppHandle,
    input: BulkPositionUpdateInput,
) -> DbResult<AppDataBulkUpdateResult> {
    with_database(&app, |connection| {
        for update in &input.nodes {
            connection
                .execute(
                    "UPDATE nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?",
                    params![update.x, update.y, now(), update.id.as_str()],
                )
                .map_err(|error| format!("Failed to update node position: {error}"))?;
        }

        Ok(AppDataBulkUpdateResult {
            success: true,
            count: input.nodes.len(),
        })
    })
}

#[tauri::command]
fn create_edge(app: AppHandle, input: EdgeCreateInput) -> DbResult<AppDataCreateEdgeResult> {
    with_database(&app, |connection| {
        let id = input
            .id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string())
            .unwrap_or_else(|| format!("e-{}-{}", input.source, input.target));

        connection
      .execute(
        "INSERT INTO edges (id, canvas_id, source_node_id, target_node_id) VALUES (?, ?, ?, ?)",
        params![id.as_str(), input.canvas_id.as_str(), input.source.as_str(), input.target.as_str()],
      )
      .map_err(|error| format!("Failed to create edge: {error}"))?;

        Ok(AppDataCreateEdgeResult { success: true, id })
    })
}

#[tauri::command]
fn delete_edge(app: AppHandle, input: IdInput) -> DbResult<AppDataDeleteResult> {
    with_database(&app, |connection| {
        connection
            .execute("DELETE FROM edges WHERE id = ?", params![input.id.as_str()])
            .map_err(|error| format!("Failed to delete edge: {error}"))?;

        Ok(AppDataDeleteResult { success: true })
    })
}

#[tauri::command]
fn load_edges(app: AppHandle, input: LoadCanvasInput) -> DbResult<Vec<AppDataEdge>> {
    with_database(&app, |connection| {
        load_edges_by_canvas_id(connection, &input.canvas_id)
    })
}

#[tauri::command]
fn load_entities(app: AppHandle, input: LoadCanvasInput) -> DbResult<AppDataLoadEntities> {
    with_database(&app, |connection| {
        Ok(AppDataLoadEntities {
            entities: load_entities_by_canvas_id(connection, &input.canvas_id)?,
            mentions: load_entity_mentions_by_canvas_id(connection, &input.canvas_id)?,
        })
    })
}

#[tauri::command]
fn search_nodes(app: AppHandle, input: SearchNodesInput) -> DbResult<Vec<AppDataNode>> {
    with_database(&app, |connection| {
        let Some(canvas_id) = input.canvas_id.as_deref() else {
            return Ok(Vec::new());
        };

        search_nodes_by_canvas_id(connection, canvas_id, &input.query, input.tag.as_deref())
    })
}

fn parse_node_value(
    node: &serde_json::Value,
) -> (String, String, String, bool, Vec<String>, f64, f64, i64) {
    let id = node
        .get("id")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .to_string();
    let title = node
        .get("title")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .to_string();
    let body = node
        .get("body")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .to_string();
    let is_entity = node
        .get("is_entity")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0)
        != 0;
    let tags = node
        .get("tags")
        .and_then(serde_json::Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let x = node
        .get("x")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.0);
    let y = node
        .get("y")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.0);
    let collapsed = node
        .get("collapsed")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);

    (id, title, body, is_entity, tags, x, y, collapsed)
}

#[tauri::command]
fn mutate_graph_fragment(
    app: AppHandle,
    input: GraphFragmentInput,
) -> DbResult<AppDataPasteGraphResult> {
    let GraphFragmentInput {
        action,
        canvas_id,
        nodes,
        edges,
        node_ids,
        edge_ids,
    } = input;

    if action == "paste" {
        let Some(canvas_id) = canvas_id.as_deref() else {
            return Err("Missing canvasId".to_string());
        };

        return with_database(&app, |connection| {
            let nodes = nodes.unwrap_or_default();
            let edges = edges.unwrap_or_default();

            let normalized_nodes = nodes
                .iter()
                .map(|node| {
                    let (id, title, body, is_entity, tags, x, y, collapsed) =
                        parse_node_value(node);
                    (
                        id,
                        title,
                        body,
                        is_entity,
                        normalize_tag_list(&tags),
                        x,
                        y,
                        collapsed,
                    )
                })
                .filter(|(id, _, _, _, _, _, _, _)| !id.is_empty())
                .collect::<Vec<_>>();

            let current_titles = get_node_titles_by_canvas_id(connection, canvas_id)?;
            let mut allocator = NodeTitleAllocator::new(&current_titles, None);
            let resolved_nodes = normalized_nodes
                .into_iter()
                .map(|(id, title, body, is_entity, tags, x, y, collapsed)| {
                    let final_title = allocator.next_copy_title(&title);
                    (id, final_title, body, is_entity, tags, x, y, collapsed)
                })
                .collect::<Vec<_>>();

            let node_ids = resolved_nodes
                .iter()
                .map(|node| node.0.clone())
                .collect::<HashSet<_>>();
            let normalized_edges = edges
                .iter()
                .map(|edge| {
                    let id = edge
                        .get("id")
                        .and_then(serde_json::Value::as_str)
                        .filter(|value| !value.is_empty())
                        .map(str::to_string)
                        .unwrap_or_else(create_id);
                    let source_node_id = edge
                        .get("source_node_id")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("")
                        .to_string();
                    let target_node_id = edge
                        .get("target_node_id")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("")
                        .to_string();
                    (id, source_node_id, target_node_id)
                })
                .filter(|(id, source, target)| {
                    !id.is_empty() && node_ids.contains(source) && node_ids.contains(target)
                })
                .collect::<Vec<_>>();

            connection
                .execute(
                    "DELETE FROM entity_mentions WHERE canvas_id = ?",
                    params![canvas_id],
                )
                .map_err(|error| format!("Failed to prepare graph paste: {error}"))?;
            connection
                .execute(
                    "DELETE FROM entities WHERE canvas_id = ?",
                    params![canvas_id],
                )
                .map_err(|error| format!("Failed to prepare graph paste: {error}"))?;

            let timestamp = now();
            for (index, node) in resolved_nodes.iter().enumerate() {
                let node_timestamp = timestamp + index as i64;
                connection
                    .execute(
                        "
              INSERT INTO nodes (
                id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
                        params![
                            node.0.as_str(),
                            canvas_id,
                            node.1.as_str(),
                            node.2.as_str(),
                            if node.3 { 1 } else { 0 },
                            node.5,
                            node.6,
                            node.7,
                            node_timestamp,
                            node_timestamp,
                        ],
                    )
                    .map_err(|error| format!("Failed to paste node: {error}"))?;
                replace_node_tags(connection, &node.0, &node.4)?;
            }

            for edge in &normalized_edges {
                connection
          .execute(
            "INSERT INTO edges (id, canvas_id, source_node_id, target_node_id) VALUES (?, ?, ?, ?)",
            params![edge.0.as_str(), canvas_id, edge.1.as_str(), edge.2.as_str()],
          )
          .map_err(|error| format!("Failed to paste edge: {error}"))?;
            }

            rebuild_entities_for_canvas_id(connection, canvas_id)?;

            Ok(AppDataPasteGraphResult {
                success: true,
                inserted_nodes: resolved_nodes
                    .into_iter()
                    .map(|node| AppDataInsertNode {
                        id: node.0,
                        title: node.1,
                    })
                    .collect(),
                inserted_edges: normalized_edges.len(),
            })
        });
    }

    if action == "delete" {
        let Some(node_ids) = node_ids else {
            return Ok(AppDataPasteGraphResult {
                success: true,
                inserted_nodes: Vec::new(),
                inserted_edges: 0,
            });
        };

        let edge_ids = edge_ids.unwrap_or_default();
        let deleted =
            delete_graph_fragment(app, GraphFragmentDeletionInput { node_ids, edge_ids })?;

        return Ok(AppDataPasteGraphResult {
            success: deleted.success,
            inserted_nodes: Vec::new(),
            inserted_edges: 0,
        });
    }

    Err("Unsupported action".to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphFragmentDeletionInput {
    node_ids: Vec<String>,
    edge_ids: Vec<String>,
}

#[tauri::command]
fn delete_graph_fragment(
    app: AppHandle,
    input: GraphFragmentDeletionInput,
) -> DbResult<GraphFragmentDeletionResult> {
    with_database(&app, |connection| {
        let node_ids = input
            .node_ids
            .into_iter()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let edge_ids = input
            .edge_ids
            .into_iter()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();

        if node_ids.is_empty() && edge_ids.is_empty() {
            return Ok(GraphFragmentDeletionResult {
                success: true,
                removed_nodes: 0,
                removed_edges: 0,
            });
        }

        let affected_canvas_ids = if node_ids.is_empty() {
            Vec::new()
        } else {
            let placeholders = node_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let query =
                format!("SELECT DISTINCT canvas_id FROM nodes WHERE id IN ({placeholders})");
            let mut stmt = connection
                .prepare(&query)
                .map_err(|error| format!("Failed to collect affected canvases: {error}"))?;
            let rows = stmt
                .query_map(rusqlite::params_from_iter(node_ids.iter()), |row| {
                    row.get::<_, Option<String>>(0)
                })
                .map_err(|error| format!("Failed to collect affected canvases: {error}"))?;

            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Failed to collect affected canvases: {error}"))?
                .into_iter()
                .flatten()
                .collect::<HashSet<_>>()
                .into_iter()
                .collect::<Vec<_>>()
        };

        for node_id in &node_ids {
            connection
                .execute(
                    "DELETE FROM edges WHERE source_node_id = ? OR target_node_id = ?",
                    params![node_id, node_id],
                )
                .map_err(|error| format!("Failed to delete connected edges: {error}"))?;
        }

        for edge_id in &edge_ids {
            connection
                .execute("DELETE FROM edges WHERE id = ?", params![edge_id])
                .map_err(|error| format!("Failed to delete edge: {error}"))?;
        }

        for node_id in &node_ids {
            connection
                .execute("DELETE FROM nodes WHERE id = ?", params![node_id])
                .map_err(|error| format!("Failed to delete node: {error}"))?;
        }

        for canvas_id in affected_canvas_ids {
            rebuild_entities_for_canvas_id(connection, &canvas_id)?;
        }

        Ok(GraphFragmentDeletionResult {
            success: true,
            removed_nodes: node_ids.len(),
            removed_edges: edge_ids.len(),
        })
    })
}

#[tauri::command]
fn export_database(app: AppHandle) -> DbResult<tauri::ipc::Response> {
    let path = db_path(&app)?;
    with_database(&app, |_| Ok(()))?;
    let bytes = fs::read(&path).map_err(|error| format!("Failed to export database: {error}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn import_database(app: AppHandle, request: tauri::ipc::Request) -> AppDataImportResult {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data.to_vec(),
        _ => {
            return AppDataImportResult {
                success: false,
                error: Some("Unexpected request body.".to_string()),
            }
        }
    };

    if bytes.is_empty() {
        return AppDataImportResult {
            success: false,
            error: Some("Imported database file is empty.".to_string()),
        };
    }

    let result = (|| -> DbResult<()> {
        let db_path = db_path(&app)?;
        let temp_root = std::env::temp_dir().join(format!("mindmap-import-{}", create_id()));
        fs::create_dir_all(&temp_root)
            .map_err(|error| format!("Failed to create import directory: {error}"))?;
        let candidate_path = temp_root.join("candidate.db");
        fs::write(&candidate_path, &bytes)
            .map_err(|error| format!("Failed to stage imported database: {error}"))?;

        let candidate_connection = open_database(&candidate_path)?;
        let mut validation_stmt = candidate_connection
            .prepare("SELECT name FROM sqlite_master LIMIT 1")
            .map_err(|error| format!("Imported database is invalid: {error}"))?;
        let mut validation_rows = validation_stmt
            .query([])
            .map_err(|error| format!("Imported database is invalid: {error}"))?;
        let _ = validation_rows
            .next()
            .map_err(|error| format!("Imported database is invalid: {error}"))?;

        if db_path.exists() {
            fs::remove_file(&db_path)
                .map_err(|error| format!("Failed to replace current database: {error}"))?;
        }

        fs::copy(&candidate_path, &db_path)
            .map_err(|error| format!("Failed to write imported database: {error}"))?;
        with_database(&app, |_| Ok(()))?;
        let _ = fs::remove_dir_all(&temp_root);
        Ok(())
    })();

    match result {
        Ok(()) => AppDataImportResult {
            success: true,
            error: None,
        },
        Err(error) => AppDataImportResult {
            success: false,
            error: Some(error),
        },
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_initial_page_data,
            update_database_settings,
            update_backup_settings,
            pick_backup_directory,
            load_canvases,
            create_canvas,
            rename_canvas,
            delete_canvas,
            load_nodes,
            create_node,
            update_node,
            delete_node,
            bulk_update_node_tags,
            bulk_update_node_positions,
            load_edges,
            create_edge,
            delete_edge,
            load_topics,
            create_topic,
            update_topic,
            delete_topic,
            load_entities,
            search_nodes,
            mutate_graph_fragment,
            delete_graph_fragment,
            create_backup_snapshot,
            restore_latest_backup,
            export_database,
            import_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use serde_json::json;

    fn seed_canvas(connection: &Connection, id: &str) {
        connection
            .execute(
                "
          INSERT INTO canvases (id, name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        ",
                params![id, "Canvas", 1_i64, 1_i64],
            )
            .expect("seed canvas");
    }

    fn seed_node(
        connection: &Connection,
        id: &str,
        canvas_id: &str,
        title: &str,
        body: &str,
        is_entity: i64,
        created_at: i64,
    ) {
        connection
            .execute(
                "
          INSERT INTO nodes (
            id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ",
                params![
                    id, canvas_id, title, body, is_entity, 0.0_f64, 0.0_f64, 0_i64, created_at,
                    created_at,
                ],
            )
            .expect("seed node");
    }

    fn seed_tag(connection: &Connection, id: &str, name: &str) {
        connection
            .execute(
                "
          INSERT INTO tags (id, name, color)
          VALUES (?, ?, ?)
        ",
                params![id, name, "#ffffff"],
            )
            .expect("seed tag");
    }

    fn link_node_tag(connection: &Connection, node_id: &str, tag_id: &str) {
        connection
            .execute(
                "
          INSERT INTO node_tags (node_id, tag_id)
          VALUES (?, ?)
        ",
                params![node_id, tag_id],
            )
            .expect("link tag");
    }

    #[test]
    fn deserializes_tauri_node_updates_from_camel_case_payloads() {
        let update: NodeUpdateInput = serde_json::from_value(json!({
            "id": "node-1",
            "title": "Aeon",
            "isEntity": true,
            "tags": ["lore"],
        }))
        .expect("deserialize update payload");

        assert_eq!(update.id, "node-1");
        assert_eq!(update.title.as_deref(), Some("Aeon"));
        assert_eq!(update.is_entity, Some(true));

        let create: NodeCreateInput = serde_json::from_value(json!({
            "id": "node-2",
            "canvasId": "canvas-1",
            "title": "Aeon",
            "body": "Entity note",
            "isEntity": true,
            "tags": ["lore"],
            "x": 12.0,
            "y": 34.0,
        }))
        .expect("deserialize create payload");

        assert_eq!(create.id.as_deref(), Some("node-2"));
        assert_eq!(create.canvas_id, "canvas-1");
        assert_eq!(create.is_entity, Some(true));
    }

    #[test]
    fn rebuilds_entities_from_primary_flags_and_mentions() {
        let connection = Connection::open_in_memory().expect("open in-memory db");
        init_schema(&connection).expect("initialize schema");
        seed_canvas(&connection, "canvas-1");
        seed_node(&connection, "node-aeon", "canvas-1", "Aeon", "", 1, 1);
        seed_node(
            &connection,
            "node-valentinism",
            "canvas-1",
            "Valentinism",
            "School of [[Aeon]].",
            0,
            2,
        );

        rebuild_entities_for_canvas_id(&connection, "canvas-1").expect("rebuild entities");

        let entities = load_entities_by_canvas_id(&connection, "canvas-1").expect("load entities");
        assert_eq!(entities.len(), 1);
        assert_eq!(
            entities
                .iter()
                .find(|entity| entity.title_key == "aeon")
                .and_then(|entity| entity.primary_node_id.clone()),
            Some("node-aeon".to_string())
        );

        let mentions =
            load_entity_mentions_by_canvas_id(&connection, "canvas-1").expect("load mentions");
        assert_eq!(mentions.len(), 1);
        assert_eq!(mentions[0].title_key, "aeon");
        assert_eq!(mentions[0].node_id, "node-valentinism");

        connection
            .execute(
                "UPDATE nodes SET is_entity = 0 WHERE id = ?",
                params!["node-aeon"],
            )
            .expect("disable primary flag");
        rebuild_entities_for_canvas_id(&connection, "canvas-1").expect("rebuild entities");

        let entities =
            load_entities_by_canvas_id(&connection, "canvas-1").expect("reload entities");
        assert_eq!(
            entities
                .iter()
                .find(|entity| entity.title_key == "aeon")
                .and_then(|entity| entity.primary_node_id.clone()),
            None
        );

        connection
            .execute(
                "UPDATE nodes SET is_entity = 1 WHERE id = ?",
                params!["node-aeon"],
            )
            .expect("enable primary flag");
        rebuild_entities_for_canvas_id(&connection, "canvas-1").expect("rebuild entities");

        let entities =
            load_entities_by_canvas_id(&connection, "canvas-1").expect("reload entities");
        assert_eq!(
            entities
                .iter()
                .find(|entity| entity.title_key == "aeon")
                .and_then(|entity| entity.primary_node_id.clone()),
            Some("node-aeon".to_string())
        );
    }

    #[test]
    fn ranks_title_matches_before_tag_and_body_matches() {
        let connection = Connection::open_in_memory().expect("open in-memory db");
        init_schema(&connection).expect("initialize schema");
        seed_canvas(&connection, "canvas-1");
        seed_tag(&connection, "tag-npc", "npc");
        seed_tag(&connection, "tag-dragon", "dragon");

        seed_node(
            &connection,
            "node-title",
            "canvas-1",
            "Dragon keeper",
            "Nothing relevant here.",
            0,
            1,
        );
        seed_node(
            &connection,
            "node-tag",
            "canvas-1",
            "Index",
            "Something else entirely.",
            0,
            2,
        );
        seed_node(
            &connection,
            "node-body",
            "canvas-1",
            "Notes",
            "The dragon sleeps below the mountain.",
            0,
            3,
        );

        link_node_tag(&connection, "node-title", "tag-npc");
        link_node_tag(&connection, "node-tag", "tag-npc");
        link_node_tag(&connection, "node-tag", "tag-dragon");
        link_node_tag(&connection, "node-body", "tag-npc");

        let results = search_nodes_by_canvas_id(&connection, "canvas-1", "dragon", Some("npc"))
            .expect("search nodes");

        assert_eq!(
            results
                .iter()
                .map(|node| node.id.as_str())
                .collect::<Vec<_>>(),
            vec!["node-title", "node-tag", "node-body"]
        );
    }
}
