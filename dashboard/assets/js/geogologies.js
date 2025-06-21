// ============================
// Load Merged Olist Dataset
// ============================
function totalRevenue(data) {
    const delivered = data.filter(d => d.order_status === "delivered");
    const total = d3.sum(delivered, d => +d.payment_value || 0);

    const formatted = total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    const revenueEl = document.getElementById("total-revenue");
    if (revenueEl) {
        revenueEl.textContent = formatted;
    }

    console.log(`💰 Total Revenue: ${formatted} (${delivered.length} delivered orders)`);
}

function meanOrderReview(data) {
    // 1. Remove duplicate orders by order_id (keep the latest by timestamp if needed)
    const uniqueOrders = Array.from(
        new Map(data.map(d => [d.order_id, d])).values()
    );

    // 2. Filter delivered orders
    const delivered = uniqueOrders.filter(d => d.order_status === "delivered");

    // 3. Exclude invalid reviews
    const validReviews = delivered.filter(d => d.review_score !== -1 && d.review_score !== null);

    // 4. Compute mean
    const meanReview = d3.mean(validReviews, d => +d.review_score || 0);
    const formatted = meanReview ? meanReview.toFixed(2) : "0.00";

    // 5. Display in UI
    const reviewEl = document.getElementById("mean-order-review");
    if (reviewEl) {
        reviewEl.textContent = formatted;
    }

    console.log(`⭐ Average Review Score: ${formatted} (from ${validReviews.length} valid reviews out of ${delivered.length} delivered orders)`);
}


function avgDeliveryTime(data) {
    // Filter delivered orders only
    const delivered = data.filter(d => d.order_status === "delivered");
    
    // Calculate delivery time for each order (in days)
    const deliveryTimes = delivered.map(order => {
        const purchaseDate = new Date(order.order_purchase_timestamp);
        const deliveredDate = new Date(order.order_delivered_customer_date);
        
        // Calculate difference in days
        const diffTime = deliveredDate - purchaseDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }).filter(days => days >= 0); // Filter out negative values (invalid dates)

    const avgDelivery = d3.mean(deliveryTimes);

    const formatted = avgDelivery.toFixed(1);
    const deliveryEl = document.getElementById("avg-delivery-time");

    if (deliveryEl) {
        deliveryEl.textContent = formatted;
    }

    console.log(`🚚 Average Delivery Time: ${formatted} days (from ${deliveryTimes.length} delivered orders)`);
}

// State name to abbreviation mapping
const stateNameToAbbr = {
  "Acre": "AC",
  "Alagoas": "AL", 
  "Amapá": "AP",
  "Amazonas": "AM",
  "Bahia": "BA",
  "Ceará": "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  "Goiás": "GO",
  "Maranhão": "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  "Pará": "PA",
  "Paraíba": "PB",
  "Paraná": "PR",
  "Pernambuco": "PE",
  "Piauí": "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  "Rondônia": "RO",
  "Roraima": "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  "Sergipe": "SE",
  "Tocantins": "TO"
};

const abbrToStateName = Object.fromEntries(
    Object.entries(stateNameToAbbr).map(([key, value]) => [value, key])
);

// Global variable for selected state
let selectedState = null;

// Function to determine text color based on background
function getTextColor(backgroundColor) {
  // Simple logic: use white text for dark backgrounds, black for light
  const rgb = d3.rgb(backgroundColor);
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128 ? "#000" : "#fff";
}

async function updateMapStats(data) {

    const stateRevenue = d3.rollup(
        data,
        (v) => d3.sum(v, (d) => +d.payment_value || 0),
        (d) => d.customer_state
    );

    console.log(stateRevenue)
    // Calculate delivery time by state
    const stateDelivery = d3.rollup(
        data.filter(d => d.order_status === "delivered"),
        (v) => {
            const deliveryTimes = v.map(order => {
                const purchaseDate = new Date(order.order_purchase_timestamp);
                const deliveredDate = new Date(order.order_delivered_customer_date);
                const diffTime = deliveredDate - purchaseDate;
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }).filter(days => days >= 0);
            return d3.mean(deliveryTimes);
        },
        (d) => d.customer_state
    );

    // Calculate review scores by state
    const stateReviews = d3.rollup(
        data.filter(d => d.order_status === "delivered" && d.review_score !== -1 && d.review_score !== null),
        (v) => d3.mean(v, (d) => +d.review_score),
        (d) => d.customer_state
    );

    // Find top performing state
    const topState = Array.from(stateRevenue.entries()).reduce((a, b) => 
        stateRevenue.get(a[0]) > stateRevenue.get(b[0]) ? a : b
    );

    // Find fastest delivery state
    const fastestDelivery = Array.from(stateDelivery.entries()).reduce((a, b) => 
        stateDelivery.get(a[0]) < stateDelivery.get(b[0]) ? a : b
    );

    // Find highest satisfaction state
    const highestSatisfaction = Array.from(stateReviews.entries()).reduce((a, b) => 
        stateReviews.get(a[0]) > stateReviews.get(b[0]) ? a : b
    );

    // Update the stats panel
    if (topState) {
        document.getElementById("top-state").textContent = topState[0];
        document.getElementById("top-state-revenue").textContent = 
            `R$ ${topState[1].toLocaleString("pt-BR")}`;
    }

    if (fastestDelivery) {
        document.getElementById("fastest-delivery").textContent = fastestDelivery[0];
        document.getElementById("fastest-delivery-days").textContent = 
            `${fastestDelivery[1].toFixed(1)} days average`;
    }

    if (highestSatisfaction) {
        document.getElementById("highest-satisfaction").textContent = highestSatisfaction[0];
        document.getElementById("highest-satisfaction-score").textContent = 
            `${highestSatisfaction[1].toFixed(2)} ★ average`;
    }

    console.log("📊 Map stats updated:", {
        topState: topState ? `${topState[0]} (R$ ${topState[1].toLocaleString()})` : "N/A",
        fastestDelivery: fastestDelivery ? `${fastestDelivery[0]} (${fastestDelivery[1].toFixed(1)} days)` : "N/A",
        highestSatisfaction: highestSatisfaction ? `${highestSatisfaction[0]} (${highestSatisfaction[1].toFixed(2)} ★)` : "N/A"
    });
}


function drawMap(data, geojson, selectedState) {
    // const margin = { top: 0, right: 30, bottom: 70, left: 0 };
    const width = 400 
    const height = 400 

    try {
        const isStateSelected = !!selectedState;

        const revenueByState = d3.rollup(
            data,
            (v) => d3.sum(v, (d) => +d.payment_value || 0),
            (d) => d.customer_state
        );

        const stateDelivery = d3.rollup(
            data.filter(d => d.order_status === "delivered"),
            (v) => {
                const deliveryTimes = v.map(order => {
                    const purchaseDate = new Date(order.order_purchase_timestamp);
                    const deliveredDate = new Date(order.order_delivered_customer_date);
                    const diffTime = deliveredDate - purchaseDate;
                    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }).filter(days => days >= 0);
                return d3.mean(deliveryTimes);
            },
            (d) => d.customer_state
        );
    
        // Calculate review scores by state
        const stateReviews = d3.rollup(
            data.filter(d => d.order_status === "delivered" && d.review_score !== -1 && d.review_score !== null),
            (v) => d3.mean(v, (d) => +d.review_score),
            (d) => d.customer_state
        );

        const container = d3.select("#brazil-map");
        container.selectAll("*").remove();

        const svg = container.append("svg")
            .attr("class", "map-svg")
            .attr("width", width)
            .attr("height", height);

        const projection = d3.geoMercator()
            .center([-54.5, -15.5])
            .scale(500)
            .translate([width / 2, (height / 2) - 20]);

        const path = d3.geoPath().projection(projection);

        const allRevenues = Array.from(revenueByState.values());
        const minRevenue = d3.min(allRevenues);
        const maxRevenue = d3.max(allRevenues);

        const colorScale = d3
            .scaleLinear()
            .domain([minRevenue, maxRevenue])
            .range(["#e0f2fe", "#0c4a6e"]);

        svg
            .selectAll("path")
            .data(geojson.features)
            .join("path")
            .attr("d", path)
            .attr("fill", (d) => {
                if (isStateSelected) {
                    const currentStateName = stateNameToAbbr[d.properties.name];
                    if (currentStateName === selectedState) {
                        return "#667eea"; // Emerald green for selected state
                    } else {
                        return "#fff"; // White for non-selected states
                    }
                } else {
                    const abbr = stateNameToAbbr[d.properties.name];
                    const revenue = revenueByState.get(abbr) || 0;
                    return colorScale(revenue);
                }
            })
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .attr("cursor", "pointer")
            .on("mouseover", function(event, d) {
                const abbr = stateNameToAbbr[d.properties.name];
                const revenue = revenueByState.get(abbr) || 0;
                const delivery = stateDelivery.get(abbr) || 0;
                const review = stateReviews.get(abbr) || 0;

                d3.select(this)
                    .attr("stroke", "#d2d5d8")
                    .attr("stroke-width", 1);

                const tooltip = d3.select("#selected-state-info");
                tooltip.style("opacity", 1)
                    .html(`
                        <strong>${d.properties.name}</strong><br>
                        Revenue: R$ ${revenue.toLocaleString("pt-BR")}<br>
                        Delivery: ${delivery.toFixed(1)} days<br>
                        Review: ${review.toFixed(2)} ★
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1);

                d3.select("#selected-state-info").style("opacity", 0);
            })
            .on("click", function(event, d) {
                const abbr = stateNameToAbbr[d.properties.name];
                updateDashboardForState(abbr);
            });

        svg.selectAll("text")
            .data(geojson.features)
            .enter()
            .append("text")
            .attr("class", "state-label")
            .attr("transform", d => `translate(${path.centroid(d)})`)
            .attr("text-anchor", "middle")
            .attr("fill", d => {
                const abbr = stateNameToAbbr[d.properties.name];
                const revenue = revenueByState.get(abbr) || 0;
                const backgroundColor = colorScale(revenue);
                return getTextColor(backgroundColor);
            })
            .text(d => {
                const abbr = stateNameToAbbr[d.properties.name]
                return abbr
            })
            .style("font-size", "10px")
            .style("cursor", "pointer")
            .on("click", function(event, d) {
                const abbr = stateNameToAbbr[d.properties.name];
                updateDashboardForState(abbr);
            });

        // legend
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width-200}, ${height - 30})`)

        const legendScale = d3
            .scaleLinear()
            .domain([minRevenue, maxRevenue])
            .range([0, 200]);

        const legendAxis = d3
            .axisBottom(legendScale)
            .ticks(5)
            .tickFormat((d) => `R$ ${Math.round(d / 1000)}k`);

        const defs = svg.append("defs");
        const linearGradient = defs
            .append("linearGradient")
            .attr("id", "legend-gradient");
        linearGradient
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#e0f2fe");
        linearGradient
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#0c4a6e");

        legend
            .append("rect")
            .attr("width", 200)
            .attr("height", 10)
            .style("fill", "url(#legend-gradient)");

        legend.append("g").attr("transform", "translate(0, 10)").call(legendAxis);

        legend
            .append("text")
            .attr("x", 100)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .attr("fill", "#333")
            .style("font-weight", "bold")
            .style("font-size", "12px")
            .text("Revenue (R$)");

        // Add click handler to map title for reset
        d3.select("#map-title")
            .style("cursor", "pointer")
            .on("click", () => {
                updateDashboardForState(null); // Pass null to reset
            });

        console.log("✅ Map rendered successfully");

    } catch (error) {
        console.error("❌ Failed to load GeoJSON:", error);
    }
}

async function drawProductTrends(data) {
    const chartContainer = d3.select("#product-trends");
    if (chartContainer.empty()){
        console.warn("⚠️ #product-trends container not found, skipping chart.");
        return;
    }
    chartContainer.selectAll("*").remove();

    const containerWidth = chartContainer.node().getBoundingClientRect().width;
    const margin = { top: 10, right: 20, bottom: 20, left: 80 };
    const width = containerWidth - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    // Create tooltip div
    const tooltip = chartContainer
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("text-align", "center")
        .style("justify-content", "center")
        .style("opacity", 0)
        .style("z-index", 1000);

    const container = chartContainer.append("svg")
        .attr("width", containerWidth)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Rollup: Count number of orders per category
    const productData = d3.rollup(
        data,
        v => v.length,
        d => d.product_category_name_english
    );

    const productArray = Array.from(productData.entries()).map(([category, count]) => ({
        product_category_name_english: category,
        order_count: count
    }));

    // Sort and take top 10
    const {sortedData, sortOrder} = sortingProductTrends(productArray, "order_count", "descending");
    const displayData = sortedData.slice(0, 5);

    // Find the max and min values for label positioning
    const maxCount = d3.max(displayData, d => d.order_count);
    const minCount = d3.min(displayData, d => d.order_count);

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(displayData, d => d.order_count)])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(displayData.map(d => d.product_category_name_english))
        .range([0, height])
        .padding(0.1);

    // Bars
    container.selectAll(".bar")
        .data(displayData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => y(d.product_category_name_english))
        .attr("width", d => x(d.order_count))
        .attr("height", y.bandwidth())
        .attr("fill", "#667eea")
        .on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(`
                <strong>${formatCategoryName(d.product_category_name_english)}</strong><br>
                Count: ${d.order_count}
            `);
            
            const chartContainer = d3.select("#product-trends").node();
            const [x, y] = d3.pointer(event, chartContainer);

            const tooltipWidth = 150; 
            const tooltipHeight = 60;
            const containerWidth = chartContainer.clientWidth;
            const containerHeight = chartContainer.clientHeight;

            let left = x + 15;
            let top = y - 30;

            if (left + tooltipWidth > containerWidth) {
                left = x - tooltipWidth - 15;
            }

            if (left < 0) {
                left = x + 15;
            }

            if (top < 0) {
                top = y + 15;
            }
            
            if (top + tooltipHeight > containerHeight) {
                top = y - tooltipHeight - 15;
            }
            
            tooltip.style("left", left + "px")
                   .style("top", top + "px");
            
            d3.select(this)
                .attr("fill", "#4c63d2");
        })
        .on("mouseout", function() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
            
            d3.select(this)
                .attr("fill", "#667eea");
        })
        .on("click", function(event, d) {
            updateDashboardForCategory(d.product_category_name_english);
        });

    container.selectAll(".bar-label")
        .data(displayData)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => {
            if ((sortOrder === -1 && d.order_count === maxCount) || (sortOrder === 1 && d.order_count === minCount)) {
                return x(d.order_count) - 5;
            }
            return x(d.order_count) + 5;
        })
        .attr("y", d => y(d.product_category_name_english) + y.bandwidth() / 2) 
        .attr("dy", "0.35em") 
        .attr("text-anchor", d => {
            if ((sortOrder === -1 && d.order_count === maxCount) || (sortOrder === 1 && d.order_count === minCount)) {
                return "end";
            }
            return "start";
        })
        .attr("fill", d => {
            if ((sortOrder === -1 && d.order_count === maxCount) || (sortOrder === 1 && d.order_count === minCount)) {
                return "#fff";
            }
            return "#333";
        })
        .style("font-size", "10px") 
        .style("font-weight", "bold") 
        .text(d => d.order_count);

    // X Axis (Order count)
    container.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(3))
        .selectAll("text")
        .style("font-weight", "bold") 
        .style("font-size", "10px");

    // Y Axis (Category names)
    container.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-weight", "bold") 
        .style("font-size", "10px")
        .style("text-overflow", "ellipsis")
        .text(d => formatCategoryName(d));

    // Add animations to the bars
    container.selectAll(".bar")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100) // Staggered animation - each bar starts 100ms after the previous
        .attr("width", d => x(d.order_count))
        .attr("fill", "#667eea");

    // Add animations to the bar labels
    container.selectAll(".bar-label")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100 + 200) // Labels animate after bars with additional delay
        .attr("x", d => {
            if ((sortOrder === -1 && d.order_count === maxCount) || (sortOrder === 1 && d.order_count === minCount)) {
                return x(d.order_count) - 5;
            }
            return x(d.order_count) + 5;
        })
        .style("opacity", 1);

    // Add smooth transitions for re-sorting (when dropdown changes)
    container.selectAll(".bar")
        .transition()
        .duration(600)
        .attr("y", d => y(d.product_category_name_english));

    container.selectAll(".bar-label")
        .transition()
        .duration(600)
        .attr("y", d => y(d.product_category_name_english) + y.bandwidth() / 2);

    // Add a reset button to the title
    d3.select("#product-trends-title")
        .style("cursor", "pointer")
        .on("click", () => {
            updateDashboardForCategory(null); // Pass null to reset
        });
}

function updateDashboardForCategory(category) {
    console.log("Filtering dashboard for category:", category || "All");
    
    selectedState = null; // Reset state filter

    const dataToFilter = window.globalData; 
    
    const filteredData = category 
        ? dataToFilter.filter(d => d.product_category_name_english === category)
        : dataToFilter;

    // Redraw visualizations with filtered data, but control which ones
    totalRevenue(filteredData);
    meanOrderReview(filteredData);
    avgDeliveryTime(filteredData);
    updateMapStats(filteredData);
    drawSalesTrends(filteredData);
    weekOrderTrends(filteredData);
    drawOrderTrendLine(filteredData);
    drawMap(filteredData, window.geojson, selectedState);
    
    // Only redraw the product trends chart on reset
    if (!category) {
        drawProductTrends(filteredData);
    }
    
    // Update dashboard title
    const subtitle = category ? `: ${formatCategoryName(category)}` : "";
    d3.select("#dashboard-title").text(`Sales Dashboard${subtitle}`);

    // Reset state dropdown UI
    if (!category) {
        const dropdown = document.getElementById("state-dropdown");
        if (dropdown) dropdown.value = "";
    }
    
    // Reset week dropdown UI
    const weekDropdown = document.getElementById("sort-direction-week");
    if (weekDropdown) weekDropdown.value = "all-weeks";
}

function updateDashboardForState(state) {
    console.log("Filtering dashboard for state:", state || "All");
    
    selectedState = state; // Set the selected state

    const dataToFilter = window.globalData; 
    
    const filteredData = state 
        ? dataToFilter.filter(d => d.customer_state === state)
        : dataToFilter;

    // Redraw all visualizations with filtered data
    totalRevenue(filteredData);
    meanOrderReview(filteredData);
    avgDeliveryTime(filteredData);
    updateMapStats(filteredData);
    drawProductTrends(filteredData);
    drawSalesTrends(filteredData);
    weekOrderTrends(filteredData);
    drawOrderTrendLine(filteredData);
    drawMap(filteredData, window.geojson, selectedState);
    
    // Update dashboard title
    const stateName = state ? abbrToStateName[state] : "";
    const subtitle = state ? `: ${stateName}` : "";
    d3.select("#dashboard-title").text(`Sales Dashboard${subtitle}`);

    // Update state dropdown UI
    const dropdown = document.getElementById("state-dropdown");
    if (dropdown) dropdown.value = state || "";
    
    // Reset week dropdown UI
    const weekDropdown = document.getElementById("sort-direction-week");
    if (weekDropdown) weekDropdown.value = "all-weeks";
}

function updateDashboardForDay(day) {
    console.log("Filtering dashboard for day:", day || "All");
    
    // Reset other filters when filtering by day
    selectedState = null;

    const dataToFilter = window.globalData; 
    
    const filteredData = day 
        ? dataToFilter.filter(d => {
            const orderDay = new Date(d.order_purchase_timestamp).getDay();
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            
            // Handle different filtering options
            switch(day.toLowerCase()) {
                case 'weekdays':
                    return orderDay >= 1 && orderDay <= 5; // Monday to Friday
                case 'weekends':
                    return orderDay === 0 || orderDay === 6; // Sunday or Saturday
                case 'monday':
                    return orderDay === 1;
                case 'tuesday':
                    return orderDay === 2;
                case 'wednesday':
                    return orderDay === 3;
                case 'thursday':
                    return orderDay === 4;
                case 'friday':
                    return orderDay === 5;
                case 'saturday':
                    return orderDay === 6;
                case 'sunday':
                    return orderDay === 0;
                default:
                    return dayNames[orderDay] === day;
            }
        })
        : dataToFilter;

    // Redraw all visualizations with filtered data
    totalRevenue(filteredData);
    meanOrderReview(filteredData);
    avgDeliveryTime(filteredData);
    updateMapStats(filteredData);
    drawProductTrends(filteredData);
    drawSalesTrends(filteredData);
    weekOrderTrends(filteredData);
    drawOrderTrendLine(filteredData);
    drawMap(filteredData, window.geojson, selectedState);
    
    // Update dashboard title
    let subtitle = "";
    if (day) {
        switch(day.toLowerCase()) {
            case 'weekdays':
                subtitle = ": Weekdays Only";
                break;
            case 'weekends':
                subtitle = ": Weekends Only";
                break;
            default:
                subtitle = `: ${day} Orders`;
        }
    }
    d3.select("#dashboard-title").text(`Sales Dashboard${subtitle}`);

    // Reset state dropdown UI
    const dropdown = document.getElementById("state-dropdown");
    if (dropdown) dropdown.value = "";

    // Sync week dropdown UI
    const weekDropdown = document.getElementById("sort-direction-week");
    if (weekDropdown) {
        if (day) {
            weekDropdown.value = day.toLowerCase();
        } else {
            weekDropdown.value = "all-weeks";
        }
    }
}

async function drawSalesTrends(data) {
    const chartContainer = d3.select("#sales-trends");

    // Clear existing SVG content before getting dimensions
    chartContainer.selectAll("*").remove();

    const containerWidth = chartContainer.node().getBoundingClientRect().width;
    const margin = { top: 10, right: 20, bottom: 20, left: 40 };
    const width = containerWidth - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    // Create tooltip div
    const tooltip = chartContainer
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("text-align", "center")
        .style("justify-content", "center")
        .style("opacity", 0)
        .style("z-index", 1000);

    const container = chartContainer.append("svg")
        .attr("width", containerWidth)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const salesData = d3.rollup(
        data,
        (v) => d3.sum(v, (d) => +d.payment_value || 0),
        (d) => d.customer_state
    );

    const salesArray = Array.from(salesData.entries()).map(([category, count]) => ({
        customer_state: category,
        payment_value: count
    }));

    // Sort and take top 10
    const {sortedData, sortOrder} = sortingSalesTrends(salesArray, "payment_value", "descending");
    const displayData = sortedData.slice(0, 5);

    // Find the max and min values for label positioning
    const maxPayment = d3.max(displayData, d => d.payment_value);
    const minPayment = d3.min(displayData, d => d.payment_value);

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(displayData, d => d.payment_value)])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(displayData.map(d => d.customer_state))
        .range([0, height])
        .padding(0.1);

    // Bars
    container.selectAll(".bar")
        .data(displayData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => y(d.customer_state))
        .attr("width", d => x(d.payment_value))
        .attr("height", y.bandwidth())
        .attr("fill", "#667eea")
        .on("mouseover", function(event, d) {
        const stateName = abbrToStateName[d.customer_state];
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(`
                <strong>${stateName}</strong><br>
                Revenue: R$ ${d.payment_value.toLocaleString()}
            `);

            const chartContainer = d3.select("#sales-trends").node();
            const [x, y] = d3.pointer(event, chartContainer);

            const tooltipWidth = 150;
            const tooltipHeight = 60;
            const containerWidth = chartContainer.clientWidth;
            const containerHeight = chartContainer.clientHeight;

            let left = x + 15;
            let top = y - 30;

            if (left + tooltipWidth > containerWidth) {
                left = x - tooltipWidth - 15;
            }

            if (left < 0) {
                left = x + 15;
            }

            if (top < 0) {
                top = y + 15;
            }

            if (top + tooltipHeight > containerHeight) {
                top = y - tooltipHeight - 15;
            }

            tooltip.style("left", left + "px")
                   .style("top", top + "px");

            d3.select(this)
                .attr("fill", "#4c63d2");
        })
        .on("mouseout", function() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);

            d3.select(this)
                .attr("fill", "#667eea");
        })
        .on("click", function(event, d) {
            updateDashboardForState(d.customer_state);
        });

    container.selectAll(".bar-label")
        .data(displayData)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => {
            if ((sortOrder === -1 && d.payment_value === maxPayment) || (sortOrder === 1 && d.payment_value === minPayment)) {
                return x(d.payment_value) - 5;
            }
            return x(d.payment_value) + 5;
        })
        .attr("y", d => y(d.customer_state) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            if ((sortOrder === -1 && d.payment_value === maxPayment) || (sortOrder === 1 && d.payment_value === minPayment)) {
                return "end";
            }
            return "start";
        })
        .attr("fill", d => {
            if ((sortOrder === -1 && d.payment_value === maxPayment) || (sortOrder === 1 && d.payment_value === minPayment)) {
                return "#fff";
            }
            return "#333";
        })
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .text(d => `R$ ${d.payment_value.toLocaleString()}`);


    // X Axis (Order count)
    container.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(3).tickFormat(d => `R$ ${Math.round(d/1000)}k`)) // Added tickFormat for X-axis
        .selectAll("text")
        .style("font-weight", "bold")
        .style("font-size", "10px");

    // Y Axis (Category names)
    container.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-weight", "bold")
        .style("font-size", "10px")
        .style("text-overflow", "ellipsis")
        .text(d => d.length > 12 ? d.substring(0, 12) + "..." : d);

    // Add animations to the bars
    container.selectAll(".bar")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100) // Staggered animation - each bar starts 100ms after the previous
        .attr("width", d => x(d.payment_value))
        .attr("fill", "#667eea");

    // Add animations to the bar labels
    container.selectAll(".bar-label")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100 + 200) // Labels animate after bars with additional delay
        .attr("x", d => {
            if ((sortOrder === -1 && d.payment_value === maxPayment) || (sortOrder === 1 && d.payment_value === minPayment)) {
                return x(d.payment_value) - 5;
            }
            return x(d.payment_value) + 5;
        })
        .style("opacity", 1);

    // Add smooth transitions for re-sorting (when dropdown changes)
    container.selectAll(".bar")
        .transition()
        .duration(600)
        .attr("y", d => y(d.customer_state));

    container.selectAll(".bar-label")
        .transition()
        .duration(600)
        .attr("y", d => y(d.customer_state) + y.bandwidth() / 2);

    // Add click handler to sales by state title for reset
    d3.select("#sales-state-title")
        .style("cursor", "pointer")
        .on("click", () => {
            updateDashboardForState(null); // Pass null to reset
        });
}

async function weekOrderTrends(data) {
    const chartContainer = d3.select("#week-order-trends");
    if (chartContainer.empty()) {
        console.warn("⚠️ #week-order-trends container not found, skipping chart.");
        return;
    }

    chartContainer.selectAll("*").remove();

    const containerWidth = chartContainer.node().getBoundingClientRect().width;
    const margin = { top: 30, right: 30, bottom: 20, left: 40 };
    const width = (containerWidth +20) - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    // --- Tooltip ---
    const tooltip = chartContainer
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    const svg = chartContainer.append("svg")
        .attr("width", containerWidth)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Data Processing ---
    const ordersByDay = d3.rollup(
        data,
        v => ({
            order_count: v.length,
            payment_value: d3.sum(v, d => d.payment_value)
        }),
        d => new Date(d.order_purchase_timestamp).getDay() // 0=Sun, 1=Mon...
    );

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const desiredOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const trendData = desiredOrder.map((day, i) => {
        const dayIndex = dayNames.indexOf(day);
        const dayData = ordersByDay.get(dayIndex) || { order_count: 0, payment_value: 0 };
        return {
            day: day,
            order_count: dayData.order_count,
            payment_value: dayData.payment_value
        };
    });

    // --- Scales ---
    const x = d3.scaleBand()
        .domain(desiredOrder)
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(trendData, d => d.order_count)])
        .range([height, 0]);

    // --- Drawing ---
    svg.selectAll(".bar")
        .data(trendData, d => d.day)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.day))
        .attr("y", height) // Start at the bottom for animation
        .attr("width", x.bandwidth())
        .attr("height", 0) // Start with 0 height for animation
        .attr("fill", "#667eea")
        .on("mouseover", function(event, d) {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong>${d.day}</strong><br>
                Orders: ${d.order_count.toLocaleString()}<br>
                Revenue: R$ ${d.payment_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            `);

            const chartContainer = d3.select("#week-order-trends").node();
            const [x, y] = d3.pointer(event, chartContainer);

            const tooltipWidth = 150;
            const tooltipHeight = 60;
            const containerWidth = chartContainer.clientWidth;
            const containerHeight = chartContainer.clientHeight;

            let left = x + 15;
            let top = y - 30;

            if (left + tooltipWidth > containerWidth) {
                left = x - tooltipWidth - 15;
            }

            if (left < 0) {
                left = x + 15;
            }

            if (top < 0) {
                top = y + 15;
            }

            if (top + tooltipHeight > containerHeight) {
                top = y - tooltipHeight - 15;
            }

            tooltip.style("left", left + "px")
                   .style("top", top + "px");

            d3.select(this)
                .attr("fill", "#4c63d2");
        })
        .on("mouseout", function() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);

            d3.select(this)
                .attr("fill", "#667eea");
        })
        .on("click", function(event, d) {
            updateDashboardForDay(d.day);
        });
        

    const maxCount = d3.max(trendData, d => d.order_count);

    svg.selectAll(".bar-label")
        .data(trendData, d => d.day)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.day) + x.bandwidth() / 2)
        .attr("y", d => d.order_count === maxCount ? y(d.order_count) + 15 : y(d.order_count) - 5)
        .attr("text-anchor", "middle")
        .attr("fill", d => d.order_count === maxCount ? "#fff" : "#333")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .style("opacity", 0)
        .text(d => d.order_count.toLocaleString());

    // --- Animations ---
    svg.selectAll(".bar")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .attr("y", d => y(d.order_count))
        .attr("height", d => height - y(d.order_count));

    svg.selectAll(".bar-label")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100 + 200)
        .style("opacity", 1);
        
    // --- Axes ---
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d.toLocaleString()));

    // Add click handler to week order trends title for reset
    d3.select("#week-order-title")
        .style("cursor", "pointer")
        .on("click", () => {
            updateDashboardForDay(null); // Pass null to reset
        });
}

function formatCategoryName(snakeCaseName) {
    if (!snakeCaseName) return "Unknown";
    return snakeCaseName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function drawOrderTrendLine(data) {
    const chartContainer = d3.select("#box-plot-container");
    if (chartContainer.empty()) {
        console.warn("⚠️ #box-plot-container not found.");
        return;
    }
    chartContainer.selectAll("*").remove();

    const margin = { top: 20, right: 50, bottom: 30, left: 40 };
    const containerWidth = chartContainer.node().getBoundingClientRect().width;
    const height = 230 - margin.top - margin.bottom;
    const width = containerWidth - margin.left - margin.right;

    // --- Tooltip ---
    const tooltip = chartContainer.append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("pointer-events", "none");

    // --- Data Processing ---
    const ordersByMonth = d3.rollup(
        data.filter(d => d.order_purchase_timestamp),
        v => v.length,
        d => d3.timeMonth(new Date(d.order_purchase_timestamp))
    );

    const trendData = Array.from(ordersByMonth, ([month, count]) => ({ month, count }))
        .sort((a, b) => a.month - b.month);

    // --- Scales ---
    const x = d3.scaleTime()
        .domain(d3.extent(trendData, d => d.month))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(trendData, d => d.count)])
        .range([height, 0])
        .nice();
        
    const svg = chartContainer.append("svg")
        .attr("width", containerWidth)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Line Generator ---
    const line = d3.line()
        .x(d => x(d.month))
        .y(d => y(d.count))
        .curve(d3.curveMonotoneX);

    // --- Drawing and Animation ---
    const path = svg.append("path")
        .datum(trendData)
        .attr("fill", "none")
        .attr("stroke", "#667eea")
        .attr("stroke-width", 2.5)
        .attr("d", line);

    // Add points on the line for tooltip interaction
    svg.selectAll(".data-point")
        .data(trendData)
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", d => x(d.month))
        .attr("cy", d => y(d.count))
        .attr("r", 4)
        .attr("fill", "#667eea")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("pointer-events", "all")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("r", 6)
                .attr("fill", "#4c63d2");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("r", 4)
                .attr("fill", "#667eea");
        });

    // --- Focus/Tooltip Logic ---
    const focus = svg.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus.append("circle")
        .attr("r", 5)
        .attr("class", "stroke-white fill-current text-primary");

    const bisectDate = d3.bisector(d => d.month).left;

    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => { 
            focus.style("display", null);
            tooltip.style("opacity", 1);
        })
        .on("mouseout", () => {
            focus.style("display", "none");
            tooltip.style("opacity", 0);
        })
        .on("mousemove", (event) => {
            const x0 = x.invert(d3.pointer(event)[0]);
            const i = bisectDate(trendData, x0, 1);
            const d0 = trendData[i - 1];
            const d1 = trendData[i];
            const d = x0 - d0.month > d1.month - x0 ? d1 : d0;
            
            focus.attr("transform", `translate(${x(d.month)},${y(d.count)})`);

            tooltip.html(`
                <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br>
                Orders: ${d.count.toLocaleString()}
            `)
            .style("left", (x(d.month) + margin.left + 15) + "px")
            .style("top", (y(d.count) + margin.top - 28) + "px");
        });

    // --- Animation ---
    const length = path.node().getTotalLength();
    path.attr("stroke-dasharray", length + " " + length)
        .attr("stroke-dashoffset", length)
        .transition()
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .duration(2000);

    // --- Axes ---
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(3)).tickFormat(d3.timeFormat("%b/%y")));
        
    svg.append("g")
        .call(d3.axisLeft(y));

    // Make sure the title is not clickable
    d3.select("#order-trends-title")
        .style("cursor", "default")
        .on("click", null);
}

function sortingProductTrends(data, sortBy = "order_count", direction = "descending") {
    if (!Array.isArray(data)) {
        console.error("❌ Invalid data format: expected array");
        return { sortedData: [], sortOrder: -1 };
    }
    const dropdown = document.getElementById("sort-direction");
    if (!dropdown) {
        console.warn("⚠️ #sort-direction not found.");
        return { sortedData: data, sortOrder: -1 };
    }
    const selectedDirection = dropdown ? dropdown.value : "descending"; 
    const dir = selectedDirection.toLowerCase();
    const sortDirection = dir === "ascending" ? 1 : -1;
    const sortedData = [...data].sort((a, b) => {
        const valA = a[sortBy] ?? 0;
        const valB = b[sortBy] ?? 0;
        return (valA - valB) * sortDirection;
    });
    return { sortedData, sortOrder: sortDirection };
}

function sortingSalesTrends(data, sortBy = "payment_value", direction = "descending") {
    if (!Array.isArray(data)) {
        console.error("❌ Invalid data format: expected array");
        return { sortedData: [], sortOrder: -1 };
    }
    const dropdown = document.getElementById("sort-direction-state");
    if (!dropdown) {
        console.warn("⚠️ #sort-direction-state not found.");
        return { sortedData: data, sortOrder: -1 };
    }
    const selectedDirection = dropdown ? dropdown.value : "descending"; 
    const dir = selectedDirection.toLowerCase();
    const sortDirection = dir === "ascending" ? 1 : -1;
    const sortedData = [...data].sort((a, b) => {
        const valA = a[sortBy] ?? 0;
        const valB = b[sortBy] ?? 0;
        return (valA - valB) * sortDirection;
    });
    return { sortedData, sortOrder: sortDirection };
}

// Add event listener for the sort direction dropdown
function initializeSortDropdown() {
    const dropdown = document.getElementById("sort-direction");
    if (dropdown) {
        dropdown.addEventListener("change", function() {
            console.log("Sort direction changed to:", this.value);
            if (window.globalData && typeof drawProductTrends === "function") {
                drawProductTrends(window.globalData);
            }
        });
    }

    const dropdown_state = document.getElementById("sort-direction-state");
    if (dropdown_state) {
        dropdown_state.addEventListener("change", function() {
            console.log("Sort direction changed to:", this.value);
            if (window.globalData && typeof drawSalesTrends === "function") {
                drawSalesTrends(window.globalData);
            }
        });
    }
}

function filterStates(data) {
    const states = Array.from(new Set(data.map(d => d.customer_state))).sort();

    const dropdown = document.getElementById("state-dropdown");
    if (!dropdown) {
        console.warn("⚠️ #state-dropdown not found.");
        return;
    }

    // Populate dropdown
    dropdown.innerHTML = '<option value="">All States</option>';
    states.forEach(state => {
        const option = document.createElement("option");
        option.value = state;
        option.textContent = state;
        dropdown.appendChild(option);
    });

    // Event listener for filtering
    dropdown.addEventListener("change", function () {
        const selectedStateValue = this.value;
        
        // Update global selectedState variable
        selectedState = selectedStateValue || null;
        
        // Filter data for metrics
        const filtered = selectedState
            ? data.filter(d => d.customer_state === selectedState)
            : data;

        console.log(`🎯 Filter by: ${selectedState || "All States"} (${filtered.length} records)`);
        
        // Update metrics with filtered data
        updateDashboardForState(selectedState);
    });
}

function setupProductSortDropdown(data) {
    const dropdown = document.getElementById("product-sort-dropdown");
    if (!dropdown) {
        console.warn("⚠️ #product-sort-dropdown not found.");
        return;
    }
    // Event listener for product sorting
    dropdown.addEventListener("change", function () {
        const sortDirection = this.value;
        console.log(`📊 Product sort direction: ${sortDirection}`);
        
        // Redraw product trends with new sort
        drawSalesTrends(data);
        drawProductTrends(data);
    });
}

function setupWeekDropdown(data) {
    const dropdown = document.getElementById("sort-direction-week");
    if (!dropdown) {
        console.warn("⚠️ #sort-direction-week not found.");
        return;
    }
    // Event listener for week filtering
    dropdown.addEventListener("change", function () {
        const selectedOption = this.value;
        console.log(`📅 Week filter: ${selectedOption}`);
        
        if (selectedOption === "all-weeks") {
            updateDashboardForDay(null); // Reset to show all data
        } else {
            updateDashboardForDay(selectedOption);
        }
    });
}

function setupResetButton() {
    const resetButton = document.getElementById("reset-all-filters");
    if (!resetButton) {
        console.warn("⚠️ #reset-all-filters not found.");
        return;
    }
    
    resetButton.addEventListener("click", function() {
        console.log("🔄 Resetting all filters...");
        resetAllFilters();
    });
}

function resetAllFilters() {
    // Reset all filters to their default state
    selectedState = null;
    
    // Reset dropdowns
    const stateDropdown = document.getElementById("state-dropdown");
    if (stateDropdown) stateDropdown.value = "";
    
    const weekDropdown = document.getElementById("sort-direction-week");
    if (weekDropdown) weekDropdown.value = "all-weeks";
    
    // Reset dashboard title
    d3.select("#dashboard-title").text("Sales Dashboard");
    
    // Redraw all visualizations with full dataset
    const fullData = window.globalData;
    totalRevenue(fullData);
    meanOrderReview(fullData);
    avgDeliveryTime(fullData);
    updateMapStats(fullData);
    drawProductTrends(fullData);
    drawSalesTrends(fullData);
    weekOrderTrends(fullData);
    drawOrderTrendLine(fullData);
    drawMap(fullData, window.geojson, selectedState);
    
    console.log("✅ All filters reset successfully");
}

function updateMetrics(data,selectedState) {
    totalRevenue(data);
    meanOrderReview(data);
    avgDeliveryTime(data);
    updateMapStats(data);
    drawProductTrends(data);
    drawSalesTrends(data);
    weekOrderTrends(data);
    drawOrderTrendLine(data);
    drawMap(data, window.geojson, selectedState);
}


let isInitialized = false;

function initializeDashboard() {
    // Prevent double execution
    if (isInitialized) {
        console.log("⚠️ Already initialized, skipping...");
        return;
    }
    isInitialized = true;
    
    console.log("🚀 Initializing dashboard...");
    
    Promise.all([
        d3.csv("./data/olist_dataset.csv", d3.autoType),
        d3.json("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson")
    ]).then(([data, geojson]) => {
        if (!data || !data.length) {
            console.warn("⚠️ No data available for processing.");
            return;
        }
        
        // Store data globally for access
        window.globalData = data;
        window.geojson = geojson;
        
        updateMetrics(data, null);    
        filterStates(data);
        setupProductSortDropdown(data);
        setupWeekDropdown(data);
        setupResetButton();
        setupLegendToggle();
        initializeSortDropdown();
    }).catch(error => {
        console.error("❌ Failed to initialize dashboard:", error);
    });
}

// Use both DOMContentLoaded and window.onload for better compatibility
document.addEventListener("DOMContentLoaded", initializeDashboard);
window.addEventListener("load", initializeDashboard);
function setupLegendToggle() {
    const legendToggle = document.getElementById("legend-toggle");
    if (!legendToggle) {
        console.warn("⚠️ #legend-toggle not found.");
        return;
    }

    let legendVisible = true;

    legendToggle.addEventListener("click", function() {
        const legend = d3.select(".legend");
        
        if (legendVisible) {
            legend.style("opacity", 0);
            legendToggle.innerHTML = '<i class="bi bi-eye-slash"></i> Show Legend';
        } else {
            legend.style("opacity", 1);
            legendToggle.innerHTML = '<i class="bi bi-eye"></i> Hide Legend';
        }
        
        legendVisible = !legendVisible;
    });
}
