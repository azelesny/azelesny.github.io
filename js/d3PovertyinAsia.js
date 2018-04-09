//wrapping everything in self executing anonymous function to move to local scope
(function(){
  //reload on window resize
window.onresize = function(){location.reload()};

//listen for overlay toggle
$("#trigger-overlay").click(function() {
        $(".overlay").addClass
        ('overlay-open');
        $('.hoverInfo').css("visibility","hidden");
        $('.dropdown').css("visibility","hidden");
        $('.factInfo').css("visibility","hidden");
      });
$( ".close" ).click(function() {
      $( ".overlay" ).removeClass
      ( 'overlay-open' );
      $('.hoverInfo').css("visibility","visible");
      $('.dropdown').css("visibility","visible");
      $('.factInfo').css("visibility","visible");
      });

//pseudo-global variables
var asianArray = ["% Poverty ($1.90 a day)", "% National Poverty","% Primary Children Out of School", "% Female Primary Children Out of School", "% Prevalance of Undernourishment","Human Development Rank", "Human Development Index", "GNI per capita", "Long_Name"];
var expressed = asianArray[0]; //initial attributes

//chart frame dimensions
var chartWidth = window.innerWidth*0.425,
    chartHeight = window.innerHeight*0.70;
    leftPadding = chartWidth*.03,
    rightPadding = chartWidth*.02,
    topPadding = chartHeight*.08,
    bottomPadding = chartHeight*.015,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topPadding - bottomPadding,
    translate = "translate(" + leftPadding + "," + topPadding + ")";

//create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
      .range([chartHeight, 0])
      .domain([0, 75]);
//execute script when window is loaded
window.onload = setMap();

//set up choropleth map
function setMap(){
  //map frame dimensions
      var width = window.innerWidth *0.5,
          height = window.innerHeight*0.70;
  //create new svg container for the map
      var map = d3.select("body")
          .append("svg")
          .attr("class", "map")
          .attr("width", width)
          .attr("height", height);
      var hoverInfo = d3.select("body")
          .append("div")
          .attr("class", "hoverInfo")
          .attr("fill", "#2A2C39")
          .text("Hover over country for detailed information");
      var factInfo = d3.select("body")
          .append("div")
          .attr("class", "factInfo")
          .attr("fill", "#2A2C39")
          .text("Poverty is not just lack of income, it manifests as limited education, hunger and malnutrition, inequality, and more.");
  //mercator projection and zoom/panning
      var projection = d3.geoPatterson()
        .center([100, 25])
        .scale(300)
        .translate([width / 2, height / 2]);
      var zoom = d3.zoom()
          .on("zoom", zoomed)
          .scaleExtent([1,8]);
      var path = d3.geoPath()
            .projection(projection);
  //zoom function to be called on zoom
    function zoomed(){
      t = d3
          .event
          .transform;
      map.selectAll("path")
        .attr("d", path)
        .attr("transform","translate("+ [t.x, t.y] + ")scale("+t.k+")");
    };
    map.call(zoom); //call zoom on map
  //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/Poverty_asia.csv") //load attributes from csv
        .defer(d3.json, "https://unpkg.com/world-atlas@1/world/110m.json")//load world background spatial data
        .defer(d3.json, "data/asia_poverty.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error,csvData,world,asia){

      //translate world and asian TopoJSON
      var worldCountries = topojson.feature(world, world.objects.countries),
          asianCountries = topojson.feature(asia, asia.objects.asia_poverty).features;
      //add world countries to map
      var wCountries = map.append("path")
          .datum(worldCountries)
          .attr("class", "world")
          .attr("d", path);
      //create the color scale
      var colorScale = makeColorScale(csvData);

      //join csv data to GeoJson enumeration setEnumerationUnits
      asianCountries = joinData(asianCountries, csvData);
      //add enumeration units to the setMap
      setEnumerationUnits(asianCountries, map, path, colorScale);
      //add coordinated visualization to the map
      setChart(csvData, colorScale);
      createDropdown(csvData);
        };//end of function callback
};//end of setMap


function joinData(asianCountries, csvData){
  //loop through csv to assign each set of csv attribute values to geojson region
      for (var i=0; i<csvData.length; i++){
          var csvRegion = csvData[i]; //the current region
          var csvKey = csvRegion.ADM0_A3; //the CSV primary key
          //loop through geojson regions to find correct region
          for (var a=0; a<asianCountries.length; a++){
              //console.log(asianCountries.length)
              var geojsonProps = asianCountries[a].properties; //the current region geojson properties
              var geojsonKey = geojsonProps.ADM0_A3; //the geojson primary key
              //where primary keys match, transfer csv data to geojson properties object
              if (geojsonKey == csvKey){
                  //assign all attributes and values
                  asianArray.forEach(function(attr){
                      if($.isNumeric(csvRegion[attr])){ //parse out Long_Name
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                          if (Number.isInteger(val)){
                            geojsonProps[attr] = val; //assign attribute and value to geojson properties
                          }else {
                            geojsonProps[attr] = val.toFixed(2); //to only 2 decimal places
                          }
                    } else {
                      geojsonProps[attr] = csvRegion[attr];//assign Long_Name
                    };
                  });
          };
      };
    };
      return asianCountries;
};//end of joinData

function setEnumerationUnits(asianCountries, map, path, colorScale){
  //add Asian Countries to map
    var asian = map.selectAll(".countries")
        .data(asianCountries)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "countries " + d.properties.ADM0_A3;
        })
        .attr("d", path)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
          highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);
    var desc = asian.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};//end setEnumerationUnits

//function to create color scale generator
function makeColorScale(data){
    //yellow to red color scheme
    var colorClasses = [
      '#ffffcc',
      '#ffeda0',
      '#fed976',
      '#feb24c',
      '#fd8d3c',
      '#fc4e2a',
      '#e31a1c',
      '#b10026'
    ];

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);
    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };
    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);
    return colorScale;
};//end of makeColorScale function

//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);

    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#8a8e89";
    };
};//end of choropleth test

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    var windowWidth = $(window).width();
    if (windowWidth >=801){
    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("transform", translate);
    //set bars for each province
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a,b){
          return b[expressed]-a[expressed] || b[expressed]-0;
        })
        .attr("class", function(d){
            return "bars " + d.ADM0_A3;
        })
        .attr("width", chartWidth / csvData.length-1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);
  var desc = bars.append("desc")
          .text('{"stroke": "none", "stroke-width": "0px"}');
      //create vertical axis generator
      var yAxis = d3.axisLeft()
          .scale(yScale)
          .tickSize(0);
      //place axis
      var axis = chart.append("g")
          .attr("class", "axis")
          .attr("transform", translate)
          .call(yAxis);
      //create chart title
      var chartTitle = chart.append("text")
              .attr("x", chartWidth*.5)
              .attr("y", chartHeight*.1)
              .attr("text-anchor", "middle")
              .attr("class", "chartTitle")
              .text(expressed);
    updateChart(bars, csvData.length,colorScale);
  } else { //for smaller screens
    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", windowWidth*.8)
        .attr("height", chartHeight)
        .attr("class", "chart");
    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", windowWidth*.8)
        .attr("height", chartHeight)
        .attr("transform", translate);
    var barWidth = (windowWidth/csvData.length-1);
    //set bars for each province
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a,b){
          return b[expressed]-a[expressed] || b[expressed]-0;
        })
        .attr("class", function(d){
            return "bars " + d.ADM0_A3;
        })
        .attr("width", windowWidth / csvData.length-1)
        .attr("tranform", function(d){
          return "translate("+barWidth+",0)"
        })
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);
  var desc = bars.append("desc")
          .text('{"stroke": "none", "stroke-width": "0px"}');
      //create vertical axis generator
      var yAxis = d3.axisLeft()
          .scale(yScale)
          .tickSize(0);
      //place axis
      var axis = chart.append("g")
          .attr("class", "axis")
          .attr("transform", translate)
          .call(yAxis);
      //create chart title
      var chartTitle = chart.append("text")
              .attr("x", windowWidth*.5)
              .attr("y", chartHeight*.1)
              .attr("text-anchor", "middle")
              .attr("class", "chartTitle")
              .text(expressed);
    updateChart(bars, csvData.length,colorScale);
  }
};//end of setChart

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //create new empty array to parse into
    dropdownArray = [];
    //parse out Long_Name
    for (var i=0; i<asianArray.length; i++){
        var val = asianArray[i];
        if (val !== "Long_Name"){
            dropdownArray.push(val);
      }
    };

    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
                    changeAttribute(this.value, csvData)
                });
    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(dropdownArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });

};//end of createDropdown

//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;
    // put attributes into arry
    var changeArray =[];
    for (var i=0; i<csvData.length; i++){
        var val = parseFloat(csvData[i][expressed]);
        changeArray.push(val);
    };
    //check for max and min values
    var maxValue = d3.max(changeArray);
    var minValue = d3.min(changeArray);

    //update the chart Y axis
    yScale = d3.scaleLinear()
      .range([chartHeight, 0])
      .domain([0, maxValue+(maxValue*.1)]);
    //recreate vertical axis generator
      var yAxis = d3.axisLeft()
          .scale(yScale)
          .tickSize(0);
      d3.selectAll("g.axis")
          .call(yAxis);
    //recreate the color scale
    var colorScale = makeColorScale(csvData);
    //recolor enumeration units
    var asian = d3.selectAll(".countries")
        .transition()
        .duration(1500)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });
    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a,b){
          return b[expressed]-a[expressed] || b[expressed]-0;
        })
        .transition() //add animation
        .delay(function(d,i){
          return i*10
        })
        .duration(1500);
      updateChart(bars, csvData.length,colorScale);
    //update factInfo
    if (expressed == "% Poverty ($1.90 a day)"){
      d3.select(".factInfo").text("767 million people live below the international poverty line of $1.90 a day.")
    } else if (expressed =="% National Poverty" ){
      d3.select(".factInfo").text("The overwhelming majority of people living below the poverty line belong to Southern Asia and sub-Saharan Africa.")
    } else if (expressed =="% Primary Children Out of School" ){
      d3.select(".factInfo").text("Enrollment in primary education in developing countries has reached 91%, but 57 million children remain out of school.")
    } else if (expressed =="% Female Primary Children Out of School" ){
      d3.select(".factInfo").text("103 million youth worldwide lack basic literacy skills, and more than 60% of them are women.")
    } else if (expressed =="% Prevalance of Undernourishment" ){
      d3.select(".factInfo").text("One in four children under age five in the world has inadequate height for his or her age.")
    } else if (expressed =="Human Development Rank" ){
      d3.select(".factInfo").text("High poverty rates are often found in small, fragile and conflict affected countries.")
    } else if (expressed =="Human Development Index" ){
      d3.select(".factInfo").text("Inequality harms growth and poverty reduction.")
    } else if (expressed =="GNI per capita" ){
      d3.select(".factInfo").text("Poverty eradication is only possible through stable and well-paid jobs.")
    };

};//end of changeAttribute

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    var windowWidth = $(window).width();
    if (windowWidth >= 801){
      //position bars
      bars.attr("x", function(d, i){
            return (i * (chartInnerWidth / n)) + leftPadding;
          })
          //resize bars
          .attr("height", function(d, i){
            //make sure attribute value is a number
            var val = parseFloat(d[expressed]);
            //is attribute value a number
            if (typeof val == 'number' && !isNaN(val)){
                return chartHeight - yScale(parseFloat(d[expressed]));
            } else {
                return 0;
            };
          })
          .attr("y", function(d, i){
            //make sure attribute value is a number
            var val = parseFloat(d[expressed]);
            //is attribute value a number
            if (typeof val == 'number' && !isNaN(val)){
                return yScale(parseFloat(d[expressed])) + bottomPadding;
            } else {
                return 0;
            };
          })
          //color/recolor bars
          .style("fill", function(d){
              return choropleth(d, colorScale);
          });
    } else {
    //position bars for mobile screens
    bars.attr("x", function(d, i){
          return (i * (windowWidth / n)) +leftPadding;
        })
        //resize bars
        .attr("height", function(d, i){
          //make sure attribute value is a number
          var val = parseFloat(d[expressed]);
          //is attribute value a number
          if (typeof val == 'number' && !isNaN(val)){
              return chartHeight - yScale(parseFloat(d[expressed]));
          } else {
              return 0;
          };
        })
        .attr("y", function(d, i){
          //make sure attribute value is a number
          var val = parseFloat(d[expressed]);
          //is attribute value a number
          if (typeof val == 'number' && !isNaN(val)){
              return yScale(parseFloat(d[expressed])) + bottomPadding;
          } else {
              return 0;
          };
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
      }//end else

    var chartTitle = d3.select(".chartTitle")
        .text(expressed);
  };//end updateChart

//function to highlight enumeration units and bars
function highlight(props){
    //change fill
    var selected = d3.selectAll("." + props.ADM0_A3)
        .style("fill-opacity","0.3")
    //call labels
    setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.ADM0_A3)
        .style("fill-opacity", function(){
            return getStyle(this, "fill-opacity")
        });
    d3.select(".infolabel")
        .remove();
    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
};

//function to create dynamic label
function setLabel(props, csvData){
  //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", [props.ADM0_A3] + "_label")
        .html(labelAttribute)

    var countryName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.Long_Name);
};//end function setLabel

//function to move info label with mouse
function moveLabel(){
  //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};//end function moveLabel

})();//last line of d3map.js
