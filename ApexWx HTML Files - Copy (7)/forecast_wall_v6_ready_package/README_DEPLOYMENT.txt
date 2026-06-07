
FORECAST WALL V6 – READY TO DEPLOY

This package creates a professional forecast wall system that runs entirely on GitHub Pages.

-------------------------------------
FOLDER STRUCTURE
-------------------------------------

forecastwall/
    opswall.html
    walls/
        wall-a.js
        radar.js
        satellite.js
        tropical.js

-------------------------------------
HOW IT WORKS
-------------------------------------

opswall.html is the MASTER ENGINE.

Each wall is controlled by a small file in:

forecastwall/walls/

Example:

radar.js
satellite.js

These files contain the map titles and image URLs.

The engine loads them automatically using the URL.

-------------------------------------
EXAMPLE URLS
-------------------------------------

Radar wall

forecastwall/opswall.html?wall=radar

Satellite wall

forecastwall/opswall.html?wall=satellite

-------------------------------------
ADDING A NEW MAP
-------------------------------------

Open the wall file:

walls/radar.js

Add a line like:

["Map Title","IMAGE URL","Map Title","IMAGE URL"]

-------------------------------------
ADDING A NEW WALL
-------------------------------------

1. Create new file

walls/newwall.js

2. Add navigation link in opswall.html

<td><a href="?wall=newwall">New Wall</a></td>

-------------------------------------
DEPLOYING TO GITHUB PAGES
-------------------------------------

1. Upload the forecastwall folder to your repository.

Example structure:

your-repo
    index.html
    trop.html
    forecastwall/
        opswall.html
        walls/

2. Commit the files.

3. Access:

https://YOURUSERNAME.github.io/forecastwall/opswall.html?wall=wall-a

-------------------------------------
ADVANTAGES
-------------------------------------

• One master engine
• Tiny wall files
• Faster editing
• Faster page load
• Mobile optimized
• Works with GitHub Pages
