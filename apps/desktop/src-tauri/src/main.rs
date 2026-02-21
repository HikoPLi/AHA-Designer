// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::path::PathBuf;
use std::io::Write;
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn run_thermal_simulation(graph_json: &str, profile: &str) -> Result<String, String> {
    let mut temp_path = env::temp_dir();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    temp_path.push(format!("aha_graph_{}_{}.json", profile, timestamp));
    
    std::fs::File::create(&temp_path)
        .and_then(|mut f| write!(f, "{}", graph_json))
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
        
    let current_dir = env::current_dir().unwrap_or_default();
    
    let possible_paths = vec![
        current_dir.join("../../../simulator/python-runner/main.py"),
        current_dir.join("../../simulator/python-runner/main.py"),
        current_dir.join("simulator/python-runner/main.py"), 
    ];
    
    let script_path = possible_paths.into_iter().find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from("../../../simulator/python-runner/main.py"));

    let output = Command::new("python3")
        .arg(&script_path)
        .arg(&temp_path)
        .output()
        .map_err(|e| format!("Failed to start python process: {}", e))?;
        
    let _ = std::fs::remove_file(&temp_path);
    
    let stdout = String::from_utf8(output.stdout).unwrap_or_default();
    
    if stdout.trim().is_empty() {
        let stderr = String::from_utf8(output.stderr).unwrap_or_default();
        return Err(format!("Python script failed or returned no output. Stderr: {}", stderr));
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, run_thermal_simulation, execute_git_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::path::PathBuf;
    use std::io::Write;

    #[test]
    fn test_python_simulator_bridge() {
        // Create an input payload mock using standard library
        let mut temp_path = std::env::temp_dir();
        temp_path.push("aha_test_input.json");
        let mut temp_file = std::fs::File::create(&temp_path).unwrap();
        write!(temp_file, r#"{{"nodes": [{{ "id": "1" }}, {{ "id": "2" }}]}}"#).unwrap();

        // Path to the python runner
        let python_script = PathBuf::from("../../../simulator/python-runner/main.py");
        let output = Command::new("python3")
            .arg(python_script)
            .arg(&temp_path)
            .output()
            .expect("failed to execute python script");

        // Clean up
        let _ = std::fs::remove_file(&temp_path);

        assert!(output.status.success());
        let stdout = String::from_utf8(output.stdout).unwrap();
        assert!(stdout.contains("success"));
        assert!(stdout.contains("power_budget_w"));
    }
}
