// ============================
// Load Merged Olist Dataset
// ============================
function totalRevenue(data) {
    const delivered = data.filter(d => d.order_status === "delivered");
    const totalPayment = d3.sum(delivered, d => +d.payment_value || 0);
    const totalFreight = d3.sum(delivered, d => +d.freight_value || 0);
    const netRevenue = totalPayment - totalFreight;

    const formatted = netRevenue.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    const revenueEl = document.getElementById("total-revenue");
    if (revenueEl) {
        revenueEl.textContent = formatted;
    }

    console.log(`💰 Total Revenue: ${formatted} (${delivered.length} delivered orders)`);
}

function totalProduct(data) {
    const uniqueProducts = Array.from(new Set(data.map(d => d.product_id))).length;
    const productEl = document.getElementById("total-product");
    if (productEl) {
        productEl.textContent = uniqueProducts;
    }

    console.log(`💰 Total Products: ${uniqueProducts} unique products`);
}

function totalDeliveredOrder(data) {
    const delivered = data.filter(d => d.order_status === "delivered");
    const uniqueDeliveredOrders = Array.from(new Set(delivered.map(d => d.order_id))).length;
    const deliveredOrderEl = document.getElementById("total-delivered-order");
    if (deliveredOrderEl) {
        deliveredOrderEl.textContent = uniqueDeliveredOrders;
    }

    console.log(`📦 Total Delivered Orders: ${uniqueDeliveredOrders} unique orders`);
}

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

function getTextColor(backgroundColor) {
    // Simple logic: use white text for dark backgrounds, black for light
    const rgb = d3.rgb(backgroundColor);
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? "#000" : "#fff";
}

function updateDashboardForState(state) {
    console.log("Filtering dashboard for state:", state || "All");
    
    selectedState = state; // Set the selected state

    const dataToFilter = window.globalData; 
    
    const filteredData = state 
        ? dataToFilter.filter(d => d.seller_state === state)
        : dataToFilter;

    // Update all metrics and charts with filtered data
    totalRevenue(filteredData);
    totalProduct(filteredData);
    totalDeliveredOrder(filteredData);
    
    // Update all charts with filtered data
    drawMap(filteredData, window.geojson, selectedState);
    drawDeliveryBySeller(filteredData);
    drawDeliveryByState(filteredData);
    drawWeekDeliveryTrends(filteredData);
    drawActiveSellersOverTime(filteredData);
    
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

    console.log(`🎯 Dashboard updated for state: ${state || "All"} (${filteredData.length} records)`);
}

function filterStates(data) {
    const states = Array.from(new Set(data.map(d => d.seller_state))).sort();

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
            ? data.filter(d => d.seller_state === selectedState)
            : data;

        console.log(`🎯 Filter by Seller State: ${selectedState || "All States"} (${filtered.length} records)`);
        
        // Update metrics with filtered data
        updateDashboardForState(selectedState);
    });
}

function drawMap(data, geojson, selectedState) {
    // const margin = { top: 0, right: 30, bottom: 70, left: 0 };
    const width = 400 
    const height = 400 

    try {
        const isStateSelected = !!selectedState;

        const revenueByState = d3.rollup(
            data.filter(d => d.order_status === "delivered"),
            (v) => {
                const totalPayment = d3.sum(v, (d) => +d.payment_value || 0);
                const totalFreight = d3.sum(v, (d) => +d.freight_value || 0);
                return totalPayment - totalFreight;
            },
            (d) => d.seller_state
        );

        const totalSellerByState = d3.rollup(
            data.filter(d => d.order_status === "delivered"),
            (v) => {
                const totalSeller = Array.from(new Set(v.map(d => d.seller_id))).length;
                return totalSeller;
            },
            (d) => d.seller_state
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
                const totalSellers = totalSellerByState.get(abbr) || 0;

                d3.select(this)
                    .attr("stroke", "#d2d5d8")
                    .attr("stroke-width", 1);

                const tooltip = d3.select("#selected-state-info");
                tooltip.style("opacity", 1)
                    .html(`
                        <strong>${d.properties.name}</strong><br>
                        Total Sellers: ${totalSellers}<br>
                        Revenue: R$ ${revenue.toLocaleString("pt-BR")}<br>
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
                // updateDashboardForState(abbr);
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
                // updateDashboardForState(null); // Pass null to reset
            });

        console.log("✅ Map rendered successfully");

    } catch (error) {
        console.error("❌ Failed to load GeoJSON:", error);
    }
}

async function drawDeliveryBySeller(data) {
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

    // Rollup: Count number of delivered orders per seller
    const sellerData = d3.rollup(
        data.filter(d => d.order_status === "delivered"),
        v => v.length,
        d => d.seller_id
    );

    const sellerArray = Array.from(sellerData.entries()).map(([sellerId, count]) => ({
        seller_id: sellerId,
        delivery_count: count
    }));

    // Get current sort direction from dropdown
    const sortDropdown = document.getElementById("sort-direction");
    const sortDirection = sortDropdown ? sortDropdown.value : "descending";
    
    // Sort data
    const {sortedData, sortOrder} = sortingProductTrends(sellerArray, "delivery_count", sortDirection);
    const displayData = sortedData.slice(0, 5);

    // Find the max and min values for label positioning
    const maxCount = d3.max(displayData, d => d.delivery_count);
    const minCount = d3.min(displayData, d => d.delivery_count);

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(displayData, d => d.delivery_count)])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(displayData.map(d => d.seller_id))
        .range([0, height])
        .padding(0.1);

    // Bars
    container.selectAll(".bar")
        .data(displayData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => y(d.seller_id))
        .attr("width", d => x(d.delivery_count))
        .attr("height", y.bandwidth())
        .attr("fill", "#667eea")
        .on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(`
                <strong>Seller ID: ${d.seller_id}</strong><br>
                Delivery Orders: ${d.delivery_count}
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
            updateDashboardForSeller(d.seller_id);
        });

    container.selectAll(".bar-label")
        .data(displayData)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => {
            if ((sortOrder === -1 && d.delivery_count === maxCount) || (sortOrder === 1 && d.delivery_count === minCount)) {
                return x(d.delivery_count) - 5;
            }
            return x(d.delivery_count) + 5;
        })
        .attr("y", d => y(d.seller_id) + y.bandwidth() / 2) 
        .attr("dy", "0.35em") 
        .attr("text-anchor", d => {
            if ((sortOrder === -1 && d.delivery_count === maxCount) || (sortOrder === 1 && d.delivery_count === minCount)) {
                return "end";
            }
            return "start";
        })
        .attr("fill", d => {
            if ((sortOrder === -1 && d.delivery_count === maxCount) || (sortOrder === 1 && d.delivery_count === minCount)) {
                return "#fff";
            }
            return "#333";
        })
        .style("font-size", "10px") 
        .style("font-weight", "bold") 
        .text(d => d.delivery_count);

    // X Axis (Delivery count)
    container.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(3))
        .selectAll("text")
        .style("font-weight", "bold") 
        .style("font-size", "10px");

    // Y Axis (Seller IDs - shortened)
    container.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-weight", "bold") 
        .style("font-size", "10px")
        .style("text-overflow", "ellipsis")
        .text(d => d.substring(0, 8) + "...");

    // Add animations to the bars
    container.selectAll(".bar")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .attr("width", d => x(d.delivery_count))
        .attr("fill", "#667eea");

    // Add animations to the bar labels
    container.selectAll(".bar-label")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100 + 200)
        .attr("x", d => {
            if ((sortOrder === -1 && d.delivery_count === maxCount) || (sortOrder === 1 && d.delivery_count === minCount)) {
                return x(d.delivery_count) - 5;
            }
            return x(d.delivery_count) + 5;
        })
        .style("opacity", 1);

    // Add smooth transitions for re-sorting (when dropdown changes)
    container.selectAll(".bar")
        .transition()
        .duration(600)
        .attr("y", d => y(d.seller_id));

    container.selectAll(".bar-label")
        .transition()
        .duration(600)
        .attr("y", d => y(d.seller_id) + y.bandwidth() / 2);

    // Add click handler to seller delivery orders title for reset
    d3.select("#seller-delivery-title")
        .style("cursor", "pointer")
        .on("click", () => {
            updateDashboardForSeller(null); // Pass null to reset
        });

    console.log("✅ Seller Delivery Orders chart rendered successfully");
}

async function drawDeliveryByState(data) {
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

    // Rollup: Count number of delivered orders per state
    const deliveryData = d3.rollup(
        data.filter(d => d.order_status === "delivered"),
        v => v.length,
        d => d.customer_state
    );

    const deliveryArray = Array.from(deliveryData.entries()).map(([state, count]) => ({
        customer_state: state,
        delivery_count: count
    }));

    // Get current sort direction from dropdown
    const sortDropdown = document.getElementById("sort-direction-state");
    const sortDirection = sortDropdown ? sortDropdown.value : "descending";
    
    // Sort data
    const {sortedData, sortOrder} = sortingSalesTrends(deliveryArray, "delivery_count", sortDirection);
    const displayData = sortedData.slice(0, 5);

    // Find the max and min values for label positioning
    const maxDelivery = d3.max(displayData, d => d.delivery_count);
    const minDelivery = d3.min(displayData, d => d.delivery_count);

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(displayData, d => d.delivery_count)])
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
        .attr("width", d => x(d.delivery_count))
        .attr("height", y.bandwidth())
        .attr("fill", "#667eea")
        .on("mouseover", function(event, d) {
            const stateName = abbrToStateName[d.customer_state];
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(`
                <strong>${stateName}</strong><br>
                Delivery Orders: ${d.delivery_count.toLocaleString()}
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
            if ((sortOrder === -1 && d.delivery_count === maxDelivery) || (sortOrder === 1 && d.delivery_count === minDelivery)) {
                return x(d.delivery_count) - 5;
            }
            return x(d.delivery_count) + 5;
        })
        .attr("y", d => y(d.customer_state) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
            if ((sortOrder === -1 && d.delivery_count === maxDelivery) || (sortOrder === 1 && d.delivery_count === minDelivery)) {
                return "end";
            }
            return "start";
        })
        .attr("fill", d => {
            if ((sortOrder === -1 && d.delivery_count === maxDelivery) || (sortOrder === 1 && d.delivery_count === minDelivery)) {
                return "#fff";
            }
            return "#333";
        })
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .text(d => d.delivery_count.toLocaleString());

    // X Axis (Delivery count)
    container.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(3).tickFormat(d => d.toLocaleString()))
        .selectAll("text")
        .style("font-weight", "bold")
        .style("font-size", "10px");

    // Y Axis (State names)
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
        .delay((d, i) => i * 100)
        .attr("width", d => x(d.delivery_count))
        .attr("fill", "#667eea");

    // Add animations to the bar labels
    container.selectAll(".bar-label")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100 + 200)
        .attr("x", d => {
            if ((sortOrder === -1 && d.delivery_count === maxDelivery) || (sortOrder === 1 && d.delivery_count === minDelivery)) {
                return x(d.delivery_count) - 5;
            }
            return x(d.delivery_count) + 5;
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

    console.log("✅ Delivery Orders by State chart rendered successfully");
}

async function drawWeekDeliveryTrends(data) {
    const chartContainer = d3.select("#week-order-trends");
    if (chartContainer.empty()) {
        console.warn("⚠️ #week-order-trends container not found, skipping chart.");
        return;
    }
    chartContainer.selectAll("*").remove();

    const containerWidth = chartContainer.node().getBoundingClientRect().width;
    const margin = { top: 30, right: 20, bottom: 20, left: 40 };
    const width = containerWidth - margin.left - margin.right;
    const height = 210 - margin.top - margin.bottom;

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

    // Get current filter from dropdown
    const weekDropdown = document.getElementById("sort-direction-week");
    const selectedFilter = weekDropdown ? weekDropdown.value : "all-weeks";

    // Filter data based on week selection
    let filteredData = data.filter(d => d.order_status === "delivered");
    
    if (selectedFilter !== "all-weeks") {
        filteredData = filteredData.filter(d => {
            const orderDay = new Date(d.order_purchase_timestamp).getDay();
            const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
            
            switch(selectedFilter) {
                case 'weekdays':
                    return orderDay >= 1 && orderDay <= 5; // Monday to Friday
                case 'weekends':
                    return orderDay === 0 || orderDay === 6; // Sunday or Saturday
                default:
                    return dayNames[orderDay] === selectedFilter;
            }
        });
    }

    // Count deliveries by day of week
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekData = d3.rollup(
        filteredData,
        v => v.length,
        d => new Date(d.order_purchase_timestamp).getDay()
    );

    // Create array with all days, filling in 0 for missing days
    const weekArray = dayNames.map((dayName, index) => ({
        day: dayName,
        dayIndex: index,
        delivery_count: weekData.get(index) || 0
    }));

    // Sort by day of week (Sunday = 0, Saturday = 6)
    weekArray.sort((a, b) => a.dayIndex - b.dayIndex);

    // Scales
    const x = d3.scaleBand()
        .domain(weekArray.map(d => d.day))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(weekArray, d => d.delivery_count)])
        .range([height, 0]);

    // Bars
    container.selectAll(".bar")
        .data(weekArray)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.day))
        .attr("y", d => y(d.delivery_count))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.delivery_count))
        .attr("fill", "#667eea")
        .on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(`
                <strong>${d.day}</strong><br>
                Delivery Orders: ${d.delivery_count.toLocaleString()}
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

    // Add value labels on bars
    container.selectAll(".bar-label")
        .data(weekArray)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.day) + x.bandwidth() / 2)
        .attr("y", d => y(d.delivery_count) - 5)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .text(d => d.delivery_count > 0 ? d.delivery_count.toLocaleString() : "");

    // X Axis (Days of week)
    container.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("font-weight", "bold")
        .style("font-size", "10px")
        .style("text-anchor", "middle");

    // Y Axis (Delivery count)
    container.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .style("font-weight", "bold")
        .style("font-size", "10px");

    // Add animations to the bars
    container.selectAll(".bar")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .attr("height", d => height - y(d.delivery_count))
        .attr("y", d => y(d.delivery_count))
        .attr("fill", "#667eea");

    // Add animations to the bar labels
    container.selectAll(".bar-label")
        .transition()
        .duration(800)
        .delay((d, i) => i * 100 + 200)
        .attr("y", d => y(d.delivery_count) - 5)
        .style("opacity", 1);

    // Add click handler to title for reset
    d3.select("#week-order-title")
        .style("cursor", "pointer")
        .on("click", () => {
            updateDashboardForDay(null); // Pass null to reset
        })
        .text("Week Delivery Trends");

    console.log("✅ Week Delivery Trends chart rendered successfully");
}

async function drawActiveSellersOverTime(data) {
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
    // Group by month and count unique sellers
    const sellersByMonth = d3.rollup(
        data.filter(d => d.order_purchase_timestamp),
        v => new Set(v.map(d => d.seller_id)).size, // Count unique sellers
        d => d3.timeMonth(new Date(d.order_purchase_timestamp))
    );

    const trendData = Array.from(sellersByMonth, ([month, count]) => ({ month, count }))
        .sort((a, b) => a.month - b.month);

    // --- Scales ---
    const x = d3.scaleTime()
        .domain(d3.extent(trendData, d => d.month))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(trendData, d => d.count)])
        .range([height, 0]);
        
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
                Active Sellers: ${d.count.toLocaleString()}
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
        .on("click", null)
        .text("Active Sellers Over Time");

    console.log("✅ Active Sellers Over Time chart rendered successfully");
}

function updateMetrics(data, selectedState) {
    totalRevenue(data);
    totalProduct(data);
    totalDeliveredOrder(data);
    drawMap(data, window.geojson, selectedState);
    drawDeliveryBySeller(data);
    drawDeliveryByState(data);
    drawWeekDeliveryTrends(data);
    drawActiveSellersOverTime(data);
}

function sortingProductTrends(data, sortBy = "delivery_count", direction = "descending") {
    if (!Array.isArray(data)) {
        console.error("❌ Invalid data format: expected array");
        return { sortedData: [], sortOrder: -1 };
    }
    
    const dir = direction.toLowerCase();
    const sortDirection = dir === "ascending" ? 1 : -1;
    const sortedData = [...data].sort((a, b) => {
        const valA = a[sortBy] ?? 0;
        const valB = b[sortBy] ?? 0;
        return (valA - valB) * sortDirection;
    });
    return { sortedData, sortOrder: sortDirection };
}

function sortingSalesTrends(data, sortBy = "delivery_count", direction = "descending") {
    if (!Array.isArray(data)) {
        console.error("❌ Invalid data format: expected array");
        return { sortedData: [], sortOrder: -1 };
    }
    
    const dir = direction.toLowerCase();
    const sortDirection = dir === "ascending" ? 1 : -1;
    const sortedData = [...data].sort((a, b) => {
        const valA = a[sortBy] ?? 0;
        const valB = b[sortBy] ?? 0;
        return (valA - valB) * sortDirection;
    });
    return { sortedData, sortOrder: sortDirection };
}

function setupSortDropdowns() {
    // Setup sort direction dropdown for seller delivery orders
    const sortDropdown = document.getElementById("sort-direction");
    if (sortDropdown) {
        sortDropdown.addEventListener("change", function() {
            console.log("🔄 Sorting seller delivery orders:", this.value);
            drawDeliveryBySeller(window.globalData);
        });
    }

    // Setup sort direction dropdown for state delivery orders
    const sortStateDropdown = document.getElementById("sort-direction-state");
    if (sortStateDropdown) {
        sortStateDropdown.addEventListener("change", function() {
            console.log("🔄 Sorting state delivery orders:", this.value);
            drawDeliveryByState(window.globalData);
        });
    }

    // Setup week filter dropdown for week delivery trends
    const weekDropdown = document.getElementById("sort-direction-week");
    if (weekDropdown) {
        weekDropdown.addEventListener("change", function() {
            console.log("🔄 Filtering week delivery trends:", this.value);
            drawWeekDeliveryTrends(window.globalData);
        });
    }
}

let isInitialized = false;

function initializeSellerDashboard() {
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
        setupSortDropdowns();
    }).catch(error => {
        console.error("❌ Failed to initialize dashboard:", error);
    });
}

// Use both DOMContentLoaded and window.onload for better compatibility
document.addEventListener("DOMContentLoaded", initializeSellerDashboard);
window.addEventListener("load", initializeSellerDashboard);

function updateDashboardForSeller(sellerId) {
    console.log("Filtering dashboard for seller:", sellerId || "All");
    
    // Reset other filters when filtering by seller
    selectedState = null;

    const dataToFilter = window.globalData; 
    
    const filteredData = sellerId 
        ? dataToFilter.filter(d => d.seller_id === sellerId)
        : dataToFilter;

    // Redraw all visualizations with filtered data
    totalRevenue(filteredData);
    totalProduct(filteredData);
    totalDeliveredOrder(filteredData);
    
    drawDeliveryBySeller(filteredData);
    drawDeliveryByState(filteredData);
    drawWeekDeliveryTrends(filteredData);
    drawActiveSellersOverTime(filteredData);
    
    // Update dashboard title
    const subtitle = sellerId ? `: Seller ${sellerId}` : "";
    d3.select("#dashboard-title").text(`Sales Dashboard${subtitle}`);

    // Reset state dropdown UI
    const dropdown = document.getElementById("state-dropdown");
    if (dropdown) dropdown.value = "";

    // Reset week dropdown UI
    const weekDropdown = document.getElementById("sort-direction-week");
    if (weekDropdown) weekDropdown.value = "all-weeks";
    
    console.log(`✅ Dashboard updated for seller: ${sellerId || "All"} (${filteredData.length} records)`);
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
    totalProduct(filteredData);
    totalDeliveredOrder(filteredData);
    
    drawDeliveryBySeller(filteredData);
    drawDeliveryByState(filteredData);
    drawWeekDeliveryTrends(filteredData);
    drawActiveSellersOverTime(filteredData);
    
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
    
    console.log(`✅ Dashboard updated for day: ${day || "All"} (${filteredData.length} records)`);
}