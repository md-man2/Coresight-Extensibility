(function (PV) {
    'use strict';

	function symbolVis() { }
    PV.deriveVisualizationFromBase(symbolVis);

    symbolVis.prototype.init = function(scope, elem) {
        this.onDataUpdate = dataUpdate;
        this.onResize = resize;

		var container = elem.find('#container')[0];
		var id = 'timeseries_' + Math.random().toString(36).substr(2, 16);
		container.id = id;
		
		var _piwebapiurl  = PV.ClientSettings.PIWebAPIUrl.replace(/\/?$/, '/');
		var wascalled = false;
		var _analysisURL;
		var _rollupPath;

		//This exists strictly to deal with the asynchronoicity of pushing objects into the series
		function clone(obj) {
			var clone ={};
			for( var key in obj ){
				clone[key]=obj[key];
			}
			return clone;
		}
		
		function convertToChartData(batchResult) {
			var series = [];
			var t = {};
			var namearr = [];
			var dataarr = [];
			
			var names = batchResult.Attributes.Content.Items;
			names.forEach(function(name) {
				var inner = name.Content.Items["0"].Identifier;
				// Prepping the name
				if (!name.Content.Items["0"].hasOwnProperty("Exception")) { // if the element doesn't contain the attribute of interest
					inner = inner.substr(0, inner.indexOf("|"));
					inner = inner.substr(inner.lastIndexOf("\\") + 1);
					namearr.push(inner);
				}
			});
			
			var data = batchResult.plotdata.Content.Items;
			var i = 0;
			data.forEach(function(item) {
				t.name = namearr[i];
				t.data = item.Content.Items.map(function(obj) {
					var date = new Date(obj.Timestamp);
					return [Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(),  date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()), Number(obj.Value)];
				});
				series.push( clone(t) );
				i++;
			});
			return series;
		}
		
		function getAnalysisRuleURL(rollupPath) {
			if (!wascalled) {
				_analysisURL = $.Deferred();
			}
			var urlfindanalysis;
			
			//Formatting query to the PI Web API
			urlfindanalysis = _piwebapiurl + "AnalysisRules/?path=" + rollupPath;
			urlfindanalysis += "\\Analyses"; 
			 
			/*
			Due to limitations in the PI Web API, it currently is impossible to search for the attribute to which an Analysis Rule outputs.
			As a result, this code is currently configured to only accept the Default Analysis name of "Analysis1".
			An Enhancement Request has been made to the Pi Web API team for this added functionailty
			*/
			
			urlfindanalysis += "[Analysis1]"; // Add the Analysis name.
			urlfindanalysis += "\\AnalysisRule";
			urlfindanalysis = urlfindanalysis.replace(/ /g,"%20");
			
			_analysisURL.resolve(urlfindanalysis);
			return _analysisURL;
		}
		
		function collectRollupAttributes(rollupPath) {
			var newplotdata = $.Deferred();
			_WebIds = $.Deferred();
			var WebIds = {};
			
			var urlfindanalysis;
			rollupPath = rollupPath.substring(0, rollupPath.indexOf('|')); // Remove the attribute name the trend is associated with
		
			getAnalysisRuleURL(rollupPath).done(function(url) {
				urlfindanalysis = url;
			});
			wascalled= true;
		
			$.ajax({
				url: urlfindanalysis,
				type: "GET",
				xhrFields: {
				  withCredentials: true
				},
				beforeSend: function(request) {
					request.setRequestHeader("Accept","text/html");
				}
			})
			.done(function(response, textStatus, xhr){
				// If we have a Rollup Analysis Output as the Attribute linked to this Trend lets get the Attributes it's rolling up
				if(response.includes("Rollup")) {
					
					var str = response.substr(response.indexOf('id="response">{') + 14);
					str = str.substr(0, str.indexOf('</pre>'));
					str = str.replace(/&quot;/g , '"');
					var json = JSON.parse(str);
					
					// Get the name of the attribute we're rolling up
					var attrInfo = json.VariableMapping;
					attrInfo = attrInfo.substr(attrInfo.indexOf('[@Name=') + 7);
					attrInfo = attrInfo.substr(0, attrInfo.indexOf(']'));
					
					// Batch request the stream sets, so as not to make too many calls.
					// Use Selected Fields to reduce the amount of info we're grabbing and speed up the process.
					
					var batchrequest = {
						"RollupElement": {
							"Method": "GET",
							"Resource": _piwebapiurl + "elements/?path=" + rollupPath + "&selectedFields=WebId;Path;Links"
						},
						"ChildElements": {
							"Method": "GET",
							"Resource": "{0}",
							"ParentIds": ["RollupElement"],
							"Parameters": ["$.RollupElement.Content.Links.Elements"]
						},
						"Attributes": {
							"Method": "GET",
							"RequestTemplate": {
								"Resource":  _piwebapiurl + "attributes/multiple?path={0}|" + attrInfo 
							},
							"ParentIds": ["ChildElements"],
							"Parameters": ["$.ChildElements.Content.Items[*].Path"]
						},
						
						"plotdata": {
							"Method": "GET",
							"RequestTemplate": {
								"Resource": _piwebapiurl + "streams/{0}/plot?selectedFields=Items.Timestamp;Items.Value"
							},
							"ParentIds": ["Attributes"],
							"Parameters": ["$.Attributes.Content.Items[*].Content.Items[*].Object.WebId"]
						}
					}
					
					$.ajax({
						url: _piwebapiurl + 'batch/',
						type: "POST",
						xhrFields: {
							withCredentials: true
						},
						data: JSON.stringify(batchrequest),
						contentType: "application/json"
					})
					.done(function(response, textStatus, xhr){
						// Take the streamset data and make it the sub it in for the data going into the plot
						newplotdata.resolve(response);
					})
					.fail(function(xhr, textStatus, errorThrown){
						console.log(xhr.status + '\n'  + textStatus + '\n' + errorThrown + '\n' + xhr.responseText + '\n');
					});
				}
			})
			.fail(function(xhr, textStatus, errorThrown){
				console.log(xhr.status + '\n'  + textStatus + '\n' + errorThrown + '\n' + xhr.responseText + '\n');
			});
			return newplotdata.promise();
		}

		var chart;
        function dataUpdate(data) {
			if(data) {
				var newplotdata;
				
				if (!wascalled) {
					_rollupPath = data.Data[0].Path;
				}
				collectRollupAttributes(_rollupPath).then(function( newplotdata ){ 
					var series = convertToChartData(newplotdata);
					if(!chart) {
						chart = new Highcharts.Chart({
							chart: {
								type: 'area',
								renderTo: id
							},
							title: {
								text: ''
							},
							xAxis: {
								type: 'datetime',
								dateTimeLabelFormats: { // don't display the dummy year
									month: '%e. %b',
									year: '%b'
								},
								title: {
									text: 'Date'
								}
							},
							plotOptions: {
								spline: {
									marker: {
										enabled: true
									}
								},
								// Allows you to stack the values on top of one another rather than referencing from 0, plus a little bit of styling
								area: {
									stacking: 'normal',
									lineColor: '#666666',
									lineWidth: 1,
									marker: {
										lineWidth: 1,
										lineColor: '#666666'
									}
								}
							},
							series: series
						});
					}
					else {
						series.forEach(function(item, index) {
							if(chart.series[index]) {
								chart.series[index].setData(item.data);
							} else {
								chart.addSeries(item);
							}
						});
					}
				});
			};
        }
        
        function resize(width, height) {
			if(chart) {
				chart.setSize(width, height);
			}
        }

    };
	
    var defintion = {
        typeName: 'stackedarea',
        datasourceBehavior: PV.Extensibility.Enums.DatasourceBehaviors.Multiple,
        visObjectType: symbolVis,
        getDefaultConfig: function() {
            return {
				DataShape: 'TimeSeries',
                DataQueryMode: PV.Extensibility.Enums.DataQueryMode.ModePlotValues,
                Interval: 400,
                Height: 200,
                Width: 400
            };
        },
		configOptions: function () {
			return [{
				title: "Format Symbol",
				mode: "format"
			}];
		}
    };
	
    PV.symbolCatalog.register(defintion);
})(window.PIVisualization);
