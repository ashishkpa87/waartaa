BookmarksController = (function () {

  var getBookmarkedLogsData = function (logTimestamp, channel_name, server_name, page) {
    var datetimeFilter = [];
    for (var i=0; i<logTimestamp.length; i++) {
      var timestamp = logTimestamp[i];
      var datetime = new Date(timestamp);
      datetimeFilter.push({
        "term": {"created": datetime}
      });
    }
    var qJSON = {
      "query": {
        "filtered": {
          "filter": {
            "and": [
              {"term": {"server_name": server_name}},
              {"term": {"channel_name": channel_name}},
              {"or": datetimeFilter}
            ]
          }
        }
      },
      "sort": [{
        "created": {"order": "asc"}
      }]
    };

    var esClient = new elasticsearch.Client({
      host: CONFIG.ELASTIC_SEARCH_HOST
    });
    // Using future to make the prcoess synchronous
    var future = Npm.require('fibers/future');
    var waiter = future.wrap(esClient.search.bind(esClient));
    try {
      var results = waiter({
        index: 'channel_logs',
        from: (parseInt(page) - 1) * CONFIG.ELASTIC_SEARCH_DATA_LIMIT,
        size: CONFIG.ELASTIC_SEARCH_DATA_LIMIT,
        body: qJSON
      }).wait();
      var data = {
        took: results.took,
        totalCount: results.hits.total,
        page: page,
        perPage: CONFIG.ELASTIC_SEARCH_DATA_LIMIT,
        logs: []
      };
      for(var i=0; i<results.hits.hits.length; i++) {
        var hit = results.hits.hits[i];
        data.logs.push(hit._source);
      }
      return data;
    } catch(err) {
      return false;
    }
  };

  var bookmarksController = RouteController.extend({
    onBeforeAction: [function (pause) {
    }],

    action: function () {
      var body = this.request.body;
      if (body) {
        var logTimestamp = body.logTimestamp || [];
        var channel_name = body.channel_name;
        var server_name = body.server_name;
        var page = body.page || 1;
        if (logTimestamp.length > 0 && channel_name && server_name) {
          var data = getBookmarkedLogsData(logTimestamp, channel_name, server_name, page);
          var resp = {
            status: true,
            results: data
          }
        } else {
          resp = {
            status: false,
            errors: ['Invalid data provided.']
          }
        }
      } else {
          resp = {
            status: false,
            errors: ['Empty data.']
          }
      }
      this.response.writeHead(200, {'Content-Type': 'application/json'});
      this.response.end(JSON.stringify(resp));
    }
  });
  return bookmarksController;
})();
