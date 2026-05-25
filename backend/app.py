import os
import xml.etree.ElementTree as ET
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# =============================================================================
# FUTURE UPDATE MEMO
# Feature:  Cacoo Diagram Import (XML -> Workflow JSON)
# Status:   Preserved for Phase 2/3 implementation
# Purpose:  Allow users to import an existing Cacoo state-diagram directly
#           into Proviso instead of building the workflow manually.
#           The /api/cacoo-fetch endpoint fetches the diagram XML from the
#           Cacoo API and transforms it into the Proviso workflow JSON format
#           { name, states[], transitions[] } ready for vault ingestion.
# TODO:     1. Complete parse_cacoo_xml() with real Cacoo XML shape/line schema
#           2. Wire a "Import from Cacoo" button into WorkflowEditor.jsx
#           3. Call this Flask endpoint from Electron main.cjs via fetch()
#           4. Map parsed diagram to useWorkflowStore.addWorkflow() payload
# =============================================================================

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

# Fallback mock data in case of parsing errors or testing
CACOO_MOCK = {
    "diagramName": "Imported from Cacoo",
    "states": [
        { "name": "Draft", "initial": True },
        { "name": "Review", "initial": False },
        { "name": "Approved", "initial": False },
    ],
    "transitions": [
        { "from": "Draft", "to": "Review" },
        { "from": "Review", "to": "Approved" },
    ]
}

def parse_cacoo_xml(xml_content):
    """
    Attempts to parse Cacoo XML.
    Reads groups with text labels as states, lines with arrows as transitions.
    """
    try:
        root = ET.fromstring(xml_content)
        states = []
        transitions = []
        
        # This is a generic XML traversal, as exact Cacoo XML schema can vary
        # Typically, shapes/groups have a <text> element.
        # Lines/connectors connect shapes by ID.
        
        # We will attempt to find elements. For now, returning mock to ensure UI works,
        # but in a real scenario we'd extract specific paths.
        
        # Example pseudo-parsing (would need actual Cacoo XML to perfect):
        # for shape in root.findall('.//shape'):
        #     text = shape.find('.//text')
        #     if text is not None and text.text:
        #         states.append({"name": text.text.strip(), "initial": len(states) == 0})
        #         
        # for line in root.findall('.//line'):
        #     # Extract source and target
        #     source = line.get('sourceId')
        #     target = line.get('targetId')
        #     # Map to text labels...
        
        # If we successfully parsed, we'd return the actual states.
        # If not, return the mock for demo purposes if it's empty.
        
        return CACOO_MOCK
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return CACOO_MOCK

@app.route('/api/cacoo-fetch', methods=['POST'])
def cacoo_fetch():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400
        
    diagram_id = data.get('diagramId')
    api_key = data.get('apiKey')
    
    if not diagram_id or not api_key:
        return jsonify({"error": "Diagram ID and API Key required"}), 400
        
    url = f"https://cacoo.com/api/v1/diagrams/{diagram_id}/contents.xml?apiKey={api_key}&returnValues=position,textStyle"
    
    try:
        # We can simulate for now if the user gave placeholder credentials
        if diagram_id == "test" or api_key == "test":
            return jsonify(CACOO_MOCK)
            
        resp = requests.get(url)
        
        if resp.status_code != 200:
            # Fallback to mock on auth failure for demo resilience
            print(f"Failed to fetch from Cacoo API: {resp.status_code} {resp.text}")
            return jsonify(CACOO_MOCK)
            
        parsed_data = parse_cacoo_xml(resp.text)
        return jsonify(parsed_data)
        
    except Exception as e:
        print(f"Fetch Exception: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run on port 5000
    port = int(os.environ.get('PORT', '5000'))
    debug = os.environ.get('FLASK_DEBUG', '').lower() in {'1', 'true', 'yes'}
    app.run(host='0.0.0.0', port=port, debug=debug)
