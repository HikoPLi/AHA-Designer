import sys
import json
from pydantic import BaseModel
from typing import List, Optional

class SimulationResult(BaseModel):
    status: str
    issues: List[str]
    report_data: dict

def run_simulation(input_file_path: str) -> SimulationResult:
    issues = []
    total_power = 0.0
    nodes_count = 0
    pmic_count = 0
    soc_count = 0

    try:
        with open(input_file_path, 'r') as f:
            data = json.load(f)
            nodes = data.get("nodes", [])
            edges = data.get("edges", [])
            nodes_count = len(nodes)
            
            node_dict = {n["id"]: n for n in nodes}

            # 1. Power Aggregation
            for node in nodes:
                cat = node.get("data", {}).get("category", "")
                if cat == "PMIC": pmic_count += 1
                if cat == "SoC": soc_count += 1
                
                tdp = node.get("data", {}).get("tdp_w", 0.0)
                try:
                    total_power += float(tdp)
                except ValueError:
                    pass
            
            # 2. DRC Checks on Edges
            for edge in edges:
                src_handle = edge.get("sourceHandle")
                tgt_handle = edge.get("targetHandle")
                src_node = node_dict.get(edge.get("source", ""), {}).get("data", {}).get("label", "Unknown")
                tgt_node = node_dict.get(edge.get("target", ""), {}).get("data", {}).get("label", "Unknown")

                if src_handle and tgt_handle:
                    if "pwr" in src_handle and "data" in tgt_handle:
                        issues.append(f"DRC Violation (Fatal): Power output from '{src_node}' connected to Data input on '{tgt_node}'.")
                    if "data" in src_handle and "pwr" in tgt_handle:
                        issues.append(f"DRC Violation (Fatal): Data output from '{src_node}' connected to Power input on '{tgt_node}'.")

            # 3. Structural DRC
            if soc_count > 0 and pmic_count == 0:
                issues.append("DRC Warning: System contains an SoC but lacks a dedicated PMIC for power delivery.")

    except Exception as e:
        return SimulationResult(
            status="error",
            issues=[f"Simulation Engine Crash: {str(e)}"],
            report_data={}
        )

    status = "error" if any("Fatal" in issue for issue in issues) else "warning" if len(issues) > 0 else "success"

    return SimulationResult(
        status=status,
        issues=issues,
        report_data={
            "nodes_analyzed": nodes_count,
            "total_power_w": total_power,
            "drc_checks_passed": len(issues) == 0
        }
    )

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing input file path"}))
        sys.exit(1)
        
    result = run_simulation(sys.argv[1])
    print(result.model_dump_json())
