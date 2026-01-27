"""
Simple SVG widget experiment - understanding marimo plugin patterns.

This creates a reactive SVG bar chart that updates when data changes.
"""

import marimo

__generated_with = "0.19.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import json

    return json, mo


@app.cell
def _(mo):
    mo.md("# SVG Widget Experiment")
    return


@app.cell
def _(mo):
    count_slider = mo.ui.slider(1, 10, value=5, label="Bar count")
    height_slider = mo.ui.slider(20, 100, value=50, label="Max height")
    mo.hstack([count_slider, height_slider])
    return count_slider, height_slider


@app.cell
def _(count_slider, height_slider, json, mo):
    # Generate bar data
    import random

    random.seed(42)  # deterministic for demo

    n = count_slider.value
    max_h = height_slider.value

    bars = [
        {
            "id": f"bar-{i}",
            "x": i * 50 + 10,
            "height": random.randint(10, max_h),
            "color": f"hsl({i * 360 // n}, 70%, 50%)",
        }
        for i in range(n)
    ]

    data_json = json.dumps(bars)

    # SVG widget with embedded JS for diffing
    html = f"""
    <div id="svg-container" style="border: 1px solid #ccc; padding: 10px;">
        <svg id="chart" width="600" height="150"></svg>
    </div>
    <script>
    (function() {{
        const svg = document.getElementById('chart');
        const data = {data_json};
        
        // Get existing bars
        const existing = new Map();
        svg.querySelectorAll('rect').forEach(rect => {{
            existing.set(rect.id, rect);
        }});
        
        const newIds = new Set(data.map(d => d.id));
        
        // Remove bars that no longer exist
        existing.forEach((rect, id) => {{
            if (!newIds.has(id)) {{
                console.log('[svg-widget] removing', id);
                rect.remove();
            }}
        }});
        
        // Add or update bars
        data.forEach(d => {{
            let rect = existing.get(d.id);
            if (!rect) {{
                // Create new bar
                console.log('[svg-widget] adding', d.id);
                rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.id = d.id;
                rect.setAttribute('width', '40');
                rect.setAttribute('y', '0');
                svg.appendChild(rect);
            }}
            // Update bar properties (with animation)
            rect.style.transition = 'all 0.3s ease';
            rect.setAttribute('x', d.x);
            rect.setAttribute('height', d.height);
            rect.setAttribute('y', 150 - d.height);
            rect.setAttribute('fill', d.color);
        }});
        
        console.log('[svg-widget] rendered', data.length, 'bars');
    }})();
    </script>
    """

    mo.Html(html)
    return


@app.cell
def _(mo):
    mo.md("""
    ## How it works
    
    1. Python generates bar data based on slider values
    2. Data is JSON-serialized into the HTML
    3. JS script diffs existing SVG elements vs new data
    4. Only changed elements are updated (with CSS transitions)
    
    **Problem**: Each cell re-run creates NEW HTML element, so diffing doesn't work across updates.
    
    The SVG is recreated each time, not updated in place.
    """)
    return


if __name__ == "__main__":
    app.run()
