// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const TRUSTEDPARTS_SEARCH_URL: &str = "https://api.trustedparts.com/v2/search";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrustedPartsQueryInput {
    company_id: String,
    api_key: String,
    search_token: String,
    country_code: Option<String>,
    exact_match: Option<bool>,
    in_stock_only: Option<bool>,
    max_results: Option<usize>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TrustedPartOffer {
    distributor: String,
    sku: Option<String>,
    stock: Option<u64>,
    moq: Option<u64>,
    currency: Option<String>,
    unit_price: Option<f64>,
    buy_url: Option<String>,
    datasheet_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TrustedPartHit {
    mpn: String,
    manufacturer: Option<String>,
    description: Option<String>,
    lifecycle_status: Option<String>,
    category_hint: String,
    offers: Vec<TrustedPartOffer>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn run_thermal_simulation(graph_json: &str, profile: &str) -> Result<String, String> {
    let mut temp_path = env::temp_dir();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get system timestamp: {e}"))?
        .as_millis();
    temp_path.push(format!("aha_graph_{}_{}.json", profile, timestamp));

    fs::File::create(&temp_path)
        .and_then(|mut file| write!(file, "{}", graph_json))
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let current_dir = env::current_dir().unwrap_or_default();
    let possible_paths = vec![
        current_dir.join("../../../simulator/python-runner/main.py"),
        current_dir.join("../../simulator/python-runner/main.py"),
        current_dir.join("simulator/python-runner/main.py"),
    ];

    let script_path = possible_paths
        .into_iter()
        .find(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from("../../../simulator/python-runner/main.py"));

    let output = Command::new("python3")
        .arg(&script_path)
        .arg(&temp_path)
        .output()
        .map_err(|e| format!("Failed to start python process: {}", e))?;

    let _ = fs::remove_file(&temp_path);

    let stdout = String::from_utf8(output.stdout).unwrap_or_default();
    if stdout.trim().is_empty() {
        let stderr = String::from_utf8(output.stderr).unwrap_or_default();
        return Err(format!(
            "Python script failed or returned no output. Stderr: {}",
            stderr
        ));
    }

    Ok(stdout)
}

#[tauri::command]
fn execute_git_command(args: Vec<String>) -> Result<String, String> {
    let output = Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    let stdout = String::from_utf8(output.stdout).unwrap_or_default();
    let stderr = String::from_utf8(output.stderr).unwrap_or_default();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Git error: {}\n{}", stderr, stdout))
    }
}

#[tauri::command]
fn save_workspace_file(path: String, graph_json: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Workspace path is empty.".to_string());
    }

    let workspace_path = PathBuf::from(trimmed);
    if let Some(parent) = workspace_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create workspace directory: {}", e))?;
    }

    fs::write(&workspace_path, graph_json)
        .map_err(|e| format!("Failed to write workspace file: {}", e))?;

    let resolved_path = workspace_path
        .canonicalize()
        .unwrap_or_else(|_| workspace_path.clone());

    Ok(resolved_path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_workspace_file(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Workspace path is empty.".to_string());
    }

    fs::read_to_string(trimmed).map_err(|e| format!("Failed to read workspace file: {}", e))
}

#[tauri::command]
async fn search_trustedparts_inventory(
    query: TrustedPartsQueryInput,
) -> Result<Vec<TrustedPartHit>, String> {
    if query.company_id.trim().is_empty() {
        return Err("TrustedParts Company ID is required.".to_string());
    }
    if query.api_key.trim().is_empty() {
        return Err("TrustedParts API Key is required.".to_string());
    }
    if query.search_token.trim().is_empty() {
        return Err("Search token cannot be empty.".to_string());
    }

    let payload = json!({
        "CompanyId": query.company_id.trim(),
        "ApiKey": query.api_key.trim(),
        "Queries": [
            {
                "SearchToken": query.search_token.trim(),
            }
        ],
        "CountryCode": query.country_code.clone().unwrap_or_else(|| "US".to_string()),
        "ExactMatch": query.exact_match.unwrap_or(false),
        "InStockOnly": query.in_stock_only.unwrap_or(true),
        "IsCrawler": false,
        "UserAgent": "AHA-Designer/0.1",
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

    let response = client
        .post(TRUSTEDPARTS_SEARCH_URL)
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("TrustedParts API request failed: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read TrustedParts API response body: {}", e))?;

    if !status.is_success() {
        let details = extract_api_error_message(&body)
            .unwrap_or_else(|| format!("HTTP {} returned by TrustedParts API.", status.as_u16()));
        return Err(details);
    }

    let json: Value = serde_json::from_str(&body)
        .map_err(|e| format!("TrustedParts API returned invalid JSON: {}", e))?;

    let mut hits = extract_parts_from_response(&json);
    let max_results = query.max_results.unwrap_or(20).clamp(1, 100);
    hits.truncate(max_results);
    Ok(hits)
}

fn extract_api_error_message(body: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body).ok()?;
    let object = parsed.as_object()?;
    get_ci(object, &["message", "error", "detail", "details"]).and_then(value_to_string)
}

fn extract_parts_from_response(root: &Value) -> Vec<TrustedPartHit> {
    let mut candidates: Vec<Map<String, Value>> = Vec::new();
    collect_candidate_part_objects(root, &mut candidates);

    let mut merged: BTreeMap<String, TrustedPartHit> = BTreeMap::new();
    for candidate in candidates {
        if let Some(part) = parse_part_candidate(&candidate) {
            let key = format!(
                "{}::{}",
                part.manufacturer
                    .as_deref()
                    .unwrap_or_default()
                    .to_lowercase(),
                part.mpn.to_lowercase()
            );

            merged
                .entry(key)
                .and_modify(|existing| {
                    merge_offers(existing, &part);
                    if existing.description.is_none() {
                        existing.description = part.description.clone();
                    }
                    if existing.lifecycle_status.is_none() {
                        existing.lifecycle_status = part.lifecycle_status.clone();
                    }
                })
                .or_insert(part);
        }
    }

    let mut results: Vec<TrustedPartHit> = merged.into_values().collect();
    results.sort_by(|a, b| {
        let a_stock = a
            .offers
            .iter()
            .filter_map(|offer| offer.stock)
            .max()
            .unwrap_or(0);
        let b_stock = b
            .offers
            .iter()
            .filter_map(|offer| offer.stock)
            .max()
            .unwrap_or(0);
        b_stock.cmp(&a_stock).then(a.mpn.cmp(&b.mpn))
    });

    results
}

fn merge_offers(existing: &mut TrustedPartHit, incoming: &TrustedPartHit) {
    let mut known: BTreeMap<String, ()> = existing
        .offers
        .iter()
        .map(|offer| {
            (
                format!(
                    "{}::{}::{}",
                    offer.distributor.to_lowercase(),
                    offer.sku.as_deref().unwrap_or_default().to_lowercase(),
                    offer.unit_price.unwrap_or(-1.0)
                ),
                (),
            )
        })
        .collect();

    for offer in &incoming.offers {
        let key = format!(
            "{}::{}::{}",
            offer.distributor.to_lowercase(),
            offer.sku.as_deref().unwrap_or_default().to_lowercase(),
            offer.unit_price.unwrap_or(-1.0)
        );
        if !known.contains_key(&key) {
            existing.offers.push(offer.clone());
            known.insert(key, ());
        }
    }

    existing.offers.sort_by(|a, b| {
        b.stock
            .unwrap_or(0)
            .cmp(&a.stock.unwrap_or(0))
            .then_with(|| a.distributor.cmp(&b.distributor))
    });
}

fn collect_candidate_part_objects(value: &Value, out: &mut Vec<Map<String, Value>>) {
    match value {
        Value::Object(object) => {
            if looks_like_part_object(object) {
                out.push(object.clone());
            }
            for child in object.values() {
                collect_candidate_part_objects(child, out);
            }
        }
        Value::Array(array) => {
            for child in array {
                collect_candidate_part_objects(child, out);
            }
        }
        _ => {}
    }
}

fn looks_like_part_object(object: &Map<String, Value>) -> bool {
    let has_mpn = get_ci(
        object,
        &[
            "ManufacturerPartNumber",
            "MPN",
            "PartNumber",
            "partNumber",
            "mpn",
            "Sku",
        ],
    )
    .is_some();
    let has_part_context = get_ci(
        object,
        &[
            "Manufacturer",
            "ManufacturerName",
            "Description",
            "Offers",
            "SellerOffers",
            "DistributorOffers",
            "DatasheetUrl",
        ],
    )
    .is_some();

    has_mpn && has_part_context
}

fn parse_part_candidate(object: &Map<String, Value>) -> Option<TrustedPartHit> {
    let mpn = get_ci(
        object,
        &[
            "ManufacturerPartNumber",
            "MPN",
            "PartNumber",
            "partNumber",
            "mpn",
            "Sku",
        ],
    )
    .and_then(value_to_string)?;

    let manufacturer = get_ci(
        object,
        &["Manufacturer", "ManufacturerName", "Mfr", "Brand", "maker"],
    )
    .and_then(value_to_string);
    let description = get_ci(
        object,
        &["Description", "ShortDescription", "Name", "description", "title"],
    )
    .and_then(value_to_string);
    let lifecycle_status = get_ci(
        object,
        &["LifecycleStatus", "Lifecycle", "Status", "PartStatus"],
    )
    .and_then(value_to_string);
    let datasheet = get_ci(
        object,
        &["DatasheetUrl", "DatasheetURL", "Datasheet", "DataSheetUrl"],
    )
    .and_then(value_to_string);

    let mut offers = extract_offers(object, datasheet.clone());
    offers.sort_by(|a, b| {
        b.stock
            .unwrap_or(0)
            .cmp(&a.stock.unwrap_or(0))
            .then_with(|| a.distributor.cmp(&b.distributor))
    });

    Some(TrustedPartHit {
        category_hint: infer_category(&mpn, description.as_deref()),
        mpn,
        manufacturer,
        description,
        lifecycle_status,
        offers,
    })
}

fn extract_offers(object: &Map<String, Value>, fallback_datasheet: Option<String>) -> Vec<TrustedPartOffer> {
    let mut offers = Vec::new();

    for key in [
        "Offers",
        "offers",
        "SellerOffers",
        "sellerOffers",
        "DistributorOffers",
        "distributorOffers",
        "Distributors",
        "distributors",
        "Sellers",
        "sellers",
        "Sources",
        "sources",
    ] {
        if let Some(Value::Array(entries)) = get_ci(object, &[key]) {
            for entry in entries {
                if let Some(entry_obj) = entry.as_object() {
                    if let Some(offer) = parse_offer(entry_obj, fallback_datasheet.clone()) {
                        offers.push(offer);
                    }
                }
            }
        }
    }

    if offers.is_empty() {
        if let Some(offer) = parse_offer(object, fallback_datasheet) {
            offers.push(offer);
        }
    }

    offers
}

fn parse_offer(object: &Map<String, Value>, fallback_datasheet: Option<String>) -> Option<TrustedPartOffer> {
    let distributor = get_ci(
        object,
        &[
            "Distributor",
            "DistributorName",
            "Seller",
            "SellerName",
            "Supplier",
            "SupplierName",
            "Source",
            "Store",
        ],
    )
    .and_then(value_to_string)
    .unwrap_or_else(|| "Unknown Distributor".to_string());

    let sku = get_ci(
        object,
        &[
            "SKU",
            "Sku",
            "PartNumber",
            "SellerPartNumber",
            "SupplierPartNumber",
        ],
    )
    .and_then(value_to_string);

    let stock = get_ci(
        object,
        &[
            "InStockQuantity",
            "QuantityAvailable",
            "Stock",
            "QtyAvailable",
            "AvailableQuantity",
        ],
    )
    .and_then(value_to_u64);

    let moq = get_ci(
        object,
        &[
            "MinimumOrderQuantity",
            "MinOrderQty",
            "MOQ",
            "MinimumQuantity",
            "moq",
        ],
    )
    .and_then(value_to_u64);

    let (unit_price, currency) = extract_unit_price(object);
    let buy_url = get_ci(
        object,
        &[
            "BuyUrl",
            "ProductUrl",
            "ProductURL",
            "Url",
            "URL",
            "Link",
            "PurchaseUrl",
        ],
    )
    .and_then(value_to_string);

    let datasheet_url = get_ci(
        object,
        &["DatasheetUrl", "DatasheetURL", "Datasheet", "DataSheetUrl"],
    )
    .and_then(value_to_string)
    .or(fallback_datasheet);

    if stock.is_none() && unit_price.is_none() && buy_url.is_none() && datasheet_url.is_none() {
        return None;
    }

    Some(TrustedPartOffer {
        distributor,
        sku,
        stock,
        moq,
        currency,
        unit_price,
        buy_url,
        datasheet_url,
    })
}

fn extract_unit_price(object: &Map<String, Value>) -> (Option<f64>, Option<String>) {
    if let Some(price) = get_ci(object, &["UnitPrice", "Price", "price"]).and_then(value_to_f64) {
        let currency = get_ci(object, &["Currency", "currency"]).and_then(value_to_string);
        return (Some(price), currency);
    }

    if let Some(prices) = get_ci(object, &["Prices", "prices", "PriceBreaks", "priceBreaks"]) {
        if let Some((price, currency)) = parse_price_container(prices) {
            return (Some(price), currency);
        }
    }

    (None, None)
}

fn parse_price_container(value: &Value) -> Option<(f64, Option<String>)> {
    match value {
        Value::Object(map) => {
            // Common format: { "USD": [ { "Price": 1.23, "Quantity": 1 } ] }
            for (currency, entry) in map {
                if let Some(price) = parse_price_value(entry) {
                    return Some((price, Some(currency.to_string())));
                }
            }
            None
        }
        Value::Array(array) => {
            for entry in array {
                if let Some(object) = entry.as_object() {
                    let price = get_ci(object, &["Price", "UnitPrice", "price"]).and_then(value_to_f64);
                    if let Some(price) = price {
                        let currency = get_ci(object, &["Currency", "currency"]).and_then(value_to_string);
                        return Some((price, currency));
                    }
                } else if let Some(price) = value_to_f64(entry) {
                    return Some((price, None));
                }
            }
            None
        }
        _ => parse_price_value(value).map(|price| (price, None)),
    }
}

fn parse_price_value(value: &Value) -> Option<f64> {
    if let Some(number) = value_to_f64(value) {
        return Some(number);
    }
    if let Some(array) = value.as_array() {
        for entry in array {
            if let Some(price) = parse_price_value(entry) {
                return Some(price);
            }
        }
    }
    if let Some(object) = value.as_object() {
        if let Some(price) = get_ci(object, &["Price", "UnitPrice", "price"]).and_then(value_to_f64) {
            return Some(price);
        }
    }
    None
}

fn infer_category(mpn: &str, description: Option<&str>) -> String {
    let desc = description.unwrap_or_default();
    let haystack = format!("{} {}", mpn, desc).to_lowercase();

    if contains_any(
        &haystack,
        &["pmic", "regulator", "buck", "boost", "ldo", "power management"],
    ) {
        return "PMIC".to_string();
    }
    if contains_any(
        &haystack,
        &[
            "sensor",
            "imu",
            "accelerometer",
            "gyroscope",
            "camera",
            "lidar",
            "temperature sensor",
        ],
    ) {
        return "Sensor".to_string();
    }
    if contains_any(
        &haystack,
        &["lpddr", "ddr", "sdram", "dram", "flash", "memory", "ram"],
    ) {
        return "Memory".to_string();
    }
    if contains_any(&haystack, &["nvme", "emmc", "nand", "ssd", "storage"]) {
        return "Storage".to_string();
    }
    if contains_any(
        &haystack,
        &["transceiver", "rf", "wifi", "bluetooth", "lte", "5g", "radio"],
    ) {
        return "RF".to_string();
    }
    if contains_any(
        &haystack,
        &["mcu", "microcontroller", "stm32", "rp2040", "esp32", "atmega"],
    ) {
        return "MCU".to_string();
    }
    if contains_any(
        &haystack,
        &["soc", "processor", "cpu", "jetson", "snapdragon", "application processor"],
    ) {
        return "SoC".to_string();
    }

    "Component".to_string()
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
}

fn get_ci<'a>(object: &'a Map<String, Value>, keys: &[&str]) -> Option<&'a Value> {
    object.iter().find_map(|(key, value)| {
        if keys.iter().any(|candidate| key.eq_ignore_ascii_case(candidate)) {
            Some(value)
        } else {
            None
        }
    })
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(boolean) => Some(boolean.to_string()),
        Value::Object(object) => get_ci(
            object,
            &[
                "Name",
                "name",
                "CompanyName",
                "DisplayName",
                "Manufacturer",
                "Label",
            ],
        )
        .and_then(value_to_string),
        _ => None,
    }
}

fn value_to_u64(value: &Value) -> Option<u64> {
    match value {
        Value::Number(number) => number.as_u64(),
        Value::String(text) => {
            let cleaned: String = text.chars().filter(|ch| ch.is_ascii_digit()).collect();
            cleaned.parse::<u64>().ok()
        }
        _ => None,
    }
}

fn value_to_f64(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => {
            let cleaned: String = text
                .chars()
                .filter(|ch| ch.is_ascii_digit() || *ch == '.' || *ch == '-')
                .collect();
            cleaned.parse::<f64>().ok()
        }
        _ => None,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            run_thermal_simulation,
            execute_git_command,
            save_workspace_file,
            load_workspace_file,
            search_trustedparts_inventory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_python_simulator_bridge() {
        let pydantic_check = Command::new("python3")
            .arg("-c")
            .arg("import pydantic")
            .output()
            .expect("failed to execute python dependency check");

        if !pydantic_check.status.success() {
            eprintln!("Skipping simulator bridge test: python dependency 'pydantic' is missing.");
            return;
        }

        let mut temp_path = std::env::temp_dir();
        temp_path.push("aha_test_input.json");
        let mut temp_file = std::fs::File::create(&temp_path).unwrap();
        write!(temp_file, r#"{{"nodes":[{{"id":"1"}},{{"id":"2"}}]}}"#).unwrap();

        let current_dir = std::env::current_dir().unwrap_or_default();
        let possible_paths = [
            current_dir.join("../../../simulator/python-runner/main.py"),
            current_dir.join("../../simulator/python-runner/main.py"),
            current_dir.join("simulator/python-runner/main.py"),
        ];
        let python_script = possible_paths
            .into_iter()
            .find(|path| path.exists())
            .expect("failed to locate simulator/python-runner/main.py");

        let output = Command::new("python3")
            .arg(python_script)
            .arg(&temp_path)
            .output()
            .expect("failed to execute python script");

        let _ = std::fs::remove_file(&temp_path);

        assert!(
            output.status.success(),
            "python runner failed with stderr: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let stdout = String::from_utf8(output.stdout).unwrap();
        assert!(stdout.contains("status"));
        assert!(stdout.contains("total_power_w"));
    }
}
