Background

Rollup analysis features in PI Asset Framework allow for simple and easy aggregation of data into a single data stream. While viewing this in PI Vision can be informative in its own right, I felt that the information could be more fully leveraged with a little creativity. With this in mind I’ve created a proof of concept PI Vision extensibility symbol which is able to take as input a rollup attribute sum into a trend and return a stacked area chart of the attributes which are being summed.
Features

Please keep in mind that this is a proof of concept, functionality is limited currently

-Capable of taking as an input a rollup attribute sum mapped to a PI Point and returning a stacked area chart of the attributes contributing to the rollup sum

-Labels each of the trends with the name of the Child Element from which a contributing child attribute is pulled
 


Getting Started

1.	Place the “sym-stackedarea.js” and “sym-stackedarea-template.html” files in the %pihome64%\PIVision\Scripts/app/editor/symbols/ext folder. Please create it if one does not exist
2.	Select the new customer symbol added to the list in PI Vision
3.	Select a rollup attribute sum and drag it onto the screen to create the symbol



Limitations

•	Due to limitations with the Web API, it is currently not possible to retrieve the associated attribute that an Analysis Rule is writing to, therefore the default Analysis Rule name of “Analysis1” was assumed. As a result, only Analyses with this name are capable of being retrieved. This enhancement request was brought to the attention of the Web API team

•	Currently being debated is the possibility of manually configuring the rollup analysis through a configuration formatting pane for the symbol.



Future Enhancements

•	This symbol currently only support Rollup Sums and excludes all other types, however it would be possible to have this customer symbol support Rollup Averages by scaling the area consumed by each to their contribution

•	This symbol currently has a default time range of 24 hours and does not assume the time range as set by PI Vision. This is currently being debugged.

•	The symbol currently searches on only attribute names being rolled up. Additional search criterion available to rollup analysis is currently being added

•	Additional improvements in performance in data retrieval on the symbol are forthcoming



Technical Discussion

In working on this symbol I drew upon resources found at the following two locations:
1.	Implementing High Charts Symbols: https://github.com/osisoft/PI-Coresight-Custom-Symbols/tree/master/tutorials/timeserieschart 
2.	Implementing Batch queries: https://pisquare.osisoft.com/community/all-things-pi/blog/2017/01/07/pi-web-api-getting-multiple-attributes-with-batch-requests 

At the start of the code, the built in data pump for PI Vision will pass the symbol data for the rollup attribute defined by the user. This information is then used to gather information on the Analysis Rule which is writing to that attribute. The information returned by the WebAPI includes the “Variable Mapping”, which is the search criterion that the rollup attribute uses to determine which attributes to include in the sum. For the sake of simplicity it is assumed that the user wants to roll up all attributes with the same name under the parent element.
With the name of the attribute being rolled up in hand, a bulk Web API request is to the batch controller which returns the data to be placed into the trend. Due to the asynchronous behavior of the Web API, promises were returned to be resolved later. In order to prevent the code from slowing down, only certain properties were returned from the batch request reducing the amount of required information.
The “convertTochartData” function originally discussed in the Implementing HighCharts symbols post was re-written to accept a new object and override PI Vision’s built-in data pump. Built-in HighCharts styling allowed for stacking rather than superimposing of the trends.
