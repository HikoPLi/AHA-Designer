import { AhaNode } from '../store/useGraphStore';
import { Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

export interface AISynthesizeResult {
    nodes: AhaNode[];
    edges: Edge[];
    explanation: string;
}

export interface AIConfig {
    provider: string;
    baseUrl: string;
    modelName: string;
    apiKey: string;
}

const SYSTEM_PROMPT = `You are an expert AI Hardware Architect (AHA). You design system-level architectures for electronics.

Your response must be ONLY valid JSON matching this exact schema:
{
  "explanation": "Brief reasoning",
  "nodes": [ { "id": "uuid", "type": "hardware", "position": {"x": 0, "y": 0}, "data": { "label": "string", "category": "SoC|MCU|Sensor|PMIC|Memory|Storage|RF", "tdp_w": float } } ],
  "edges": [ { "id": "uuid", "source": "uuid", "target": "uuid", "type": "smoothstep", "label": "bus name e.g. PCIe, I2C, PWR 5V" } ]
}

Rules:
1. "type" field inside nodes must ALWAYS be "hardware".
2. Position nodes logically so they don't overlap (x, y spacing ~200).
3. Connect power lines (PMIC to consumers) and data buses.
4. Output strictly valid parseable JSON. No markdown backticks.`;

export const synthesizeArchitecture = async (prompt: string, config: AIConfig): Promise<AISynthesizeResult> => {
    if (config.provider !== 'ollama' && !config.apiKey) {
        throw new Error("API Key is missing for cloud provider. Please provide a valid API Key.");
    }

    const endpoint = config.baseUrl.replace(/\/$/, '') + '/chat/completions';

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify({
            model: config.modelName,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2
        })
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `API request failed with status ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices[0].message.content;

    try {
        const parsed = JSON.parse(content);

        // Ensure UUIDs are fresh for React Flow just in case LLM reused names instead of real UUIDs
        const idMapping: Record<string, string> = {};
        parsed.nodes.forEach((n: any) => {
            const newId = uuidv4();
            idMapping[n.id] = newId;
            n.id = newId;
        });
        parsed.edges.forEach((e: any) => {
            e.id = uuidv4();
            e.source = idMapping[e.source] || e.source;
            e.target = idMapping[e.target] || e.target;
        });

        return {
            nodes: parsed.nodes || [],
            edges: parsed.edges || [],
            explanation: parsed.explanation || "Architecture generated successfully."
        };
    } catch (e) {
        throw new Error("Failed to parse LLM output as valid architecture JSON.");
    }
};
