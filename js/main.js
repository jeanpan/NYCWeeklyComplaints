(function(){
  "use strict";

  var map = L.map('map').setView([40.716928, -73.611788], 11),
      info = L.control();

  var CartoDBTiles = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw', {
      maxZoom: 18,
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
      '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="http://mapbox.com">Mapbox</a>',
      id: 'mapbox.light'
  });

  var count = 0,
      communityDistricts = [],
      communityDistrictGeoJson;

  // data used to plot bar chart
  var comparisonData = {
    labels: [
      'Water', 'Public Safety', 'Construction', 'Noise', 'Sanitation', 'Transportation'
    ],
    series: []
  };

  var keywords = [
    ["Water"],
    ['Hazardous'],
    ['Construction'],
    ['Noise'],
    ['Food', 'Graffiti'],
    ['Traffic', 'Taxi', 'Park']
  ];

  // add tiles to map.
  map.addLayer(CartoDBTiles);

  // control that shows community district info on hover
  info.setPosition('bottomleft');

  info.onAdd = function() {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
  };

  info.update = function (props) {
    this._div.innerHTML = '<h4>NYC Community District</h4>' +  (props ?
      '<b>' + convert2Boroughs(props.borocd) + '</b><br />'
      : 'Hover over a CD');
  };

  // add info to map.
  info.addTo(map);

  /*
  $('img.clean').on('click', function() {
    comparisonData.series.splice(0, comparisonData.series.length);
    plotBarChart(comparisonData);
    count = 0;
    focusedCds = [];
    communityDistrictGeoJson.resetStyle(CartoDBTiles);
  });
  */

  // NYC Neighborhood Data
  $.getJSON('data/NYC_Community_Districts.geojson', function(data) {
    var communityDistrictData = data;

    var style = function() {
      return {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.6,
        fillColor: '#ffc0cb'
      };
    };

    var highlightFeature = function(e) {
      var layer = e.target;

      layer.setStyle({
        weight: 5,
        color: '#999',
        dashArray: '',
        fillOpacity: 0.6
      });

      if (!L.Browser.ie && !L.Browser.opera) {
        layer.bringToFront();
      }

      info.update(layer.feature.properties);
    }

    var resetHighlight = function(e) {
      var layer = e.target;

      layer.setStyle({
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.6
      });

      info.update();
    }

    var focusFeature = function(e) {
      var target = e.target,
          cd = target.feature.properties.borocd,
          index = communityDistricts.indexOf(cd);

      var colors = d3.scale.category10().domain(d3.range(20)),
          color = colors(count);

      var focusStyle = {
        fillColor: color,
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7,
      };

      var originalStyle = {
        fillOpacity: 0.6,
        fillColor: '#ffc0cb'
      };

      if (index > -1) {
        // existing community district
        communityDistricts.splice(index, 1);

        count -= 1;
        // set back to original style
        target.setStyle(originalStyle);

      } else {
        // new community district
        communityDistricts.push(cd);

        count += 1;
        // set focus style
        target.setStyle(focusStyle);

      }

      getNYC311Data(cd, color);
    }

    var onEachFeature = function(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: focusFeature
      });
    }

    communityDistrictGeoJson = L.geoJson(communityDistrictData, {
      style: style,
      onEachFeature: onEachFeature
    }).addTo(map);

  });

  function zeroPad(num, places) {
    var zero = places - num.toString().length + 1;
    return new Array(+(zero > 0 && zero)).join("0") + num;
  }

  function convert2Boroughs(id) {
    var boroughs = ['MANHATTAN', 'BRONX', 'BROOKLYN', 'QUEENS', 'STATEN ISLAND'],
        borough = boroughs[Math.floor(parseInt(id) / 100) - 1],
        num = zeroPad(parseInt(id) % 100, 2);

    return num + ' ' + borough;
  }

  function getNYC311Data(id, color) {
    var cd = convert2Boroughs(id),
        token = 'rQIMJbYqnCnhVM9XNPHE9tj0g',
        url = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json?$$app_token=' + token + '&Community%20Board=' + encodeURI(cd) + '&status=Open';

    $.getJSON(url, function(data) {
      compositeComparisonData(data, id, color);
    });
  }

  function compositeComparisonData(data, id, color) {

    var existing = false;

    for(var s = 0; s < comparisonData.series.length; s++) {
      if (id === comparisonData.series[s].label) {
        comparisonData.series.splice(s, 1);
        existing = true;
      }
    }

    if(!existing) {
      var arr = [0, 0, 0, 0, 0, 0];

      data.forEach(function(obj) {

        var type = obj.complaint_type.split(/[\s/]+/);
        // var type = obj.complaint_type;
        console.log(type);

        for(var i = 0; i < type.length; i++) {
          var isFind = false;
          if (isFind) break;

          for(var j = 0; j < keywords.length; j++) {
            if (keywords[j].indexOf(type[i]) > -1) {
              arr[j] += 1;
              isFind = true;
              break;
            }
          }
        }
      });

      var dcObj = {
        label: id,
        values: arr,
        color: color
      };

      comparisonData.series.push(dcObj);
    }

    plotGroupedBarChart(comparisonData);
  }

  function plotGroupedBarChart(data) {

    var chartWidth       = 500,
        barHeight        = 20,
        groupHeight      = barHeight * data.series.length,
        gapBetweenGroups = 20,
        spaceForLabels   = 150,
        spaceForLegend   = 90;

    // Zip the series data together (first values, second values, etc.)
    var zippedData = [];
    for (var i = 0; i < data.labels.length; i++) {
      for (var j = 0; j < data.series.length; j++) {
        zippedData.push(data.series[j].values[i]);
      }
    }

    var chartHeight = barHeight * zippedData.length + gapBetweenGroups * data.labels.length;

    var x = d3.scale.linear()
        .domain([0, d3.max(zippedData)])
        .range([0, chartWidth]);

    var y = d3.scale.linear()
        .range([chartHeight + gapBetweenGroups, 0]);

    var yAxis = d3.svg.axis()
        .scale(y)
        .tickFormat('')
        .tickSize(0)
        .orient("left");

    // Specify the chart area and dimensions
    d3.select(".chart").html("");

    var chart = d3.select(".chart")
        .attr("width", spaceForLabels + chartWidth + spaceForLegend)
        .attr("height", chartHeight);

    // Create bars
    var bar = chart.selectAll("g")
        .data(zippedData)
        .enter().append("g")
        .attr("transform", function(d, i) {
          return "translate(" + spaceForLabels + "," + (i * barHeight + gapBetweenGroups * (0.5 + Math.floor(i/data.series.length))) + ")";
        });

    // Create rectangles of the correct width
    bar.append("rect")
        .style("fill", function(d,i) { return data.series[i % data.series.length].color; })
        .style("stroke", function(d,i) { return data.series[i % data.series.length].color; })
        .attr("class", "bar")
        .attr("width", x)
        .attr("height", barHeight - 1);

    // Add text label in bar
    bar.append("text")
        .attr("x", function(d) { return x(d) - 3; })
        .attr("y", barHeight / 2)
        .attr("fill", "red")
        .attr("dy", ".35em")
        .text(function(d) { return d; });

    // Draw labels
    bar.append("text")
        .attr("class", "label")
        .attr("x", function(d) { return - 10; })
        .attr("y", groupHeight / 2)
        .attr("dy", ".35em")
        .text(function(d,i) {
          if (i % data.series.length === 0)
            return data.labels[Math.floor(i/data.series.length)];
          else
            return "";
        });

    /*
    chart.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(" + spaceForLabels + ", " + -gapBetweenGroups/2 + ")")
          .call(yAxis);
    */

    // Draw legend
    var legendRectSize = 18,
        legendSpacing  = 4;

    var legend = chart.selectAll('.legend')
        .data(data.series)
        .enter()
        .append('g')
        .attr('transform', function (d, i) {
            var height = legendRectSize + legendSpacing;
            var offset = -gapBetweenGroups/2;
            var horz = spaceForLabels + chartWidth + 50 - legendRectSize;
            var vert = i * height - offset;
            return 'translate(' + horz + ',' + vert + ')';
        });

    legend.append('rect')
        .attr('width', legendRectSize)
        .attr('height', legendRectSize)
        .style('fill', function (d, i) { return data.series[i].color; })
        .style('stroke', function (d, i) { return data.series[i].color; });

    legend.append('text')
        .attr('class', 'legend')
        .attr('x', legendRectSize + legendSpacing)
        .attr('y', legendRectSize - legendSpacing)
        .text(function (d) { return d.label; });

  }

})();
