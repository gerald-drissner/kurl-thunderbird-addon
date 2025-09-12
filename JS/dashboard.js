const $ = (id) => document.getElementById(id);

// --- State variables for pagination ---
let currentOffset = 0;
const linksPerPage = 10; // How many links to load at a time

/**
 * Updates all text content in the document based on the browser's locale.
 */
function internationalize() {
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.getAttribute('data-i18n-key');
        const message = browser.i18n.getMessage(key);
        if (message) {
            el.textContent = message;
        }
    });
}

/**
 * Loads the main dashboard stats (the cards at the top).
 */
async function loadStats() {
    try {
        $('server-status').textContent = browser.i18n.getMessage('dashboardStatusLoading');
        $('server-status').classList.remove('status-online');

        const statsRes = await browser.runtime.sendMessage({ type: "GET_DASHBOARD_STATS" });

        if (statsRes && statsRes.ok) {
            const statsData = statsRes.data;
            const stats = statsData.stats || statsData;

            const totalLinks = parseInt(stats.total_links || 0, 10);
            const totalClicks = parseInt(stats.total_clicks || 0, 10);

            $('total-links').textContent = totalLinks.toLocaleString();
            $('total-clicks').textContent = totalClicks.toLocaleString();
            $('avg-clicks').textContent = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : '0.0';
            $('server-status').textContent = browser.i18n.getMessage('dashboardStatusOnline');
            $('server-status').classList.add('status-online');
        } else {
            throw new Error(statsRes.reason || 'Failed to load stats');
        }
    } catch(e) {
        console.error("Stats Error:", e);
        $('server-status').textContent = browser.i18n.getMessage('dashboardStatusError');
    }
}

/**
 * Loads a "page" of recent links.
 * @param {boolean} clearExisting - If true, clears the list before adding new links.
 */
async function loadMoreLinks(clearExisting = false) {
    const container = $('recent-links-container');
    const viewMoreContainer = $('view-more-container');
    const loadingMsg = browser.i18n.getMessage('dashboardStatusLoading');

    if (clearExisting) {
        container.innerHTML = `<p>${loadingMsg}</p>`;
        currentOffset = 0;
    }

    viewMoreContainer.innerHTML = `<span>${loadingMsg}</span>`;

    try {
        const linksRes = await browser.runtime.sendMessage({
            type: "GET_RECENT_LINKS",
            limit: linksPerPage,
            start: currentOffset
        });

        if (linksRes && linksRes.ok) {
            if (clearExisting) container.innerHTML = '';

            const links = linksRes.data.links;
            viewMoreContainer.innerHTML = '';

            if (!links || Object.keys(links).length === 0) {
                if (clearExisting) container.innerHTML = `<p>${browser.i18n.getMessage('dashboardNoLinksFound')}</p>`;
                return;
            }

            const linkCount = Object.keys(links).length;

            for (const key in links) {
                const link = links[key];
                const linkEl = document.createElement('div');
                linkEl.className = 'link-item';
                linkEl.innerHTML = `
                <div class="link-urls">
                <a href="${link.shorturl}" target="_blank" class="link-short">${link.shorturl.replace(/https?:\/\//, '')}</a>
                <span class="link-long">${link.url}</span>
                </div>
                <div class="link-clicks">
                ${parseInt(link.clicks, 10).toLocaleString()} clicks
                </div>
                `;
                container.appendChild(linkEl);
            }

            currentOffset += linkCount;

            if (linkCount === linksPerPage) {
                const viewMoreBtn = document.createElement('button');
                viewMoreBtn.textContent = browser.i18n.getMessage('dashboardBtnViewMore') || 'View More';                viewMoreBtn.className = 'secondary';
                viewMoreBtn.addEventListener('click', () => loadMoreLinks(false));
                viewMoreContainer.appendChild(viewMoreBtn);
            }

        } else {
            throw new Error(linksRes.reason || 'Failed to load recent links');
        }
    } catch (e) {
        console.error("Dashboard Links Error:", e);
        viewMoreContainer.innerHTML = '';
        container.innerHTML = `<p class="error-message">Error: ${e.message}</p>`;
    }
}

/**
 * Initializes the entire dashboard on page load.
 */
function initializeDashboard() {
    internationalize();
    loadStats();
    loadMoreLinks(true);
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
$('refresh-btn').addEventListener('click', initializeDashboard);
