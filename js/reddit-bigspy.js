(function ($, tinycolor) {
    "use strict";


    var Utils = {
        "popRandom": function (arr) {
            var item, index = Math.floor(Math.random() * arr.length);
            item = arr[index];
            arr.splice(index, 1);
            return item;
        },
    };


    /* Redit */

    var Reddit = function () {
        this.currSubreddit = undefined;

        this.hot = [];
        this.lastHot = undefined;

        this.new = [];
        this.lastNew = undefined;

        this.seen = {};
    };

    Reddit.prototype.switchSubreddit = function (subreddit) {
        this.currSubreddit = subreddit;
        this.hot = [];
        this.new = [];
    };

    Reddit.prototype.apiCall = function (path, callback) {
        var apiEndpoint = "http://www.reddit.com/" + path;

        $.ajax({
            "url": apiEndpoint,
            "dataType": "jsonp",
            "jsonp": "jsonp",
            "success": function (response) {
                callback(response.data);
            },
        });
    };

    Reddit.prototype.refreshHot = function (callback) {
        var path = "", that = this;

        if (this.currSubreddit) {
            path += "r/" + this.currSubreddit;
        }
        path += "hot.json";
        if (this.lastHot) {
            path += "?after=" + this.lastHot;
        }

        this.apiCall(path, function (data) {
            var posts = data.children;
            posts.forEach(function (post) {
                post = post.data;
                if (!that.seen.hasOwnProperty(post.name)) {
                    that.hot.push(post);
                    that.seen[post.name] = true;
                }
            });
            if (posts) {
                that.lastHot = posts.pop().data.name;
            }
            if (callback) {
                callback();
            }
        });
    };

    Reddit.prototype.refreshNew = function (callback) {
        var path = "", that = this;

        if (this.currSubreddit) {
            path += "r/" + this.currSubreddit;
        }
        path += "new.json";
        if (this.lastNew) {
            path += "?after=" + this.lastNew;
        }

        this.apiCall(path, function (data) {
            var posts = data.children;
            posts.forEach(function (post) {
                post = post.data;
                if (!that.seen.hasOwnProperty(post.name)) {
                    that.new.push(post);
                    that.seen[post.name] = true;
                }
            });
            if (posts) {
                that.lastNew = posts.pop().data.name;
            }
            if (callback) {
                callback();
            }
        });
    };

    Reddit.prototype.hotPost = function () {
        if (this.hot.length < 5) {
            this.refreshHot();
        }

        if (this.hot.length > 0) {
            return Utils.popRandom(this.hot);
        }
    };

    Reddit.prototype.newPost = function () {
        if (this.hot.length < 5) {
            this.refreshNew();
        }

        if (this.hot.length > 0) {
            return Utils.popRandom(this.new);
        }
    };


    /* Reddit BigSpy view */

    var RedditBigSpyView = function () {
        this.$feed = $("#feed");
        this.registerSettings();
    };

    RedditBigSpyView.prototype.registerSettings = function () {
        $("#settings-dialog").dialog({
            "autoOpen": false,
        });

        $("#settings-button").click(function () {
            $("#settings-dialog").dialog("open");
        });
    };

    RedditBigSpyView.prototype.getPostColor = function (score) {
        var green = tinycolor("#ffff4a"), desatAmount,
            upperBound = 3000.0;
        score = +score;
        desatAmount = score > upperBound ? 0: 100 - (100 * score / upperBound);
        return tinycolor.desaturate(green, desatAmount).toHexString();
    };

    RedditBigSpyView.prototype.showPost = function (post) {
        if (post) {
            var $li, $row, $score, $postTitle, $subredditLink,
                $subredditLabel;

            $li = $("<li>");
            $row = $("<div class='row feed-item'>");

            // score cell
            $score = $("<span class='badge'>").text(post.score);
            $score.css("background-color", this.getPostColor(post.score));
            $("<div class='col-md-1 score-cell'>").append($score).appendTo($row);

            // title cell
            $subredditLink = $("<a>")
                .attr("href", "http://reddit.com/r/" + post.subreddit)
                .text(post.subreddit);
            $subredditLabel = $("<span class='label label-default'>")
                .append($subredditLink);
            $postTitle = $("<a>")
                .attr("href", post.url)
                .text(post.title);
            $("<div class='col-md-10 title-cell'>")
                .append($subredditLabel)
                .append($postTitle)
                .appendTo($row);

            $("<div class='col-md-1'>").text("comments").appendTo($row);
            $li.wrapInner($row).hide();
            var MAX_ITEMS = 30;
            this.$feed.prepend($li);
            $li.show("drop");

            if (this.$feed.children().length > MAX_ITEMS) {
                this.$feed.children().last().remove();
            }
        }
    };


    /* Reddit BigSpy */

    var RedditBigSpy = function () {
        this.api = new Reddit();
        this.view = new RedditBigSpyView();
        this.percentNew = 0.2;
        this.postInterval = 2000;
    };

    RedditBigSpy.prototype.start = function () {
        var that = this;
        this.api.refreshHot(function () {
            var firstPost = that.api.hotPost();
            window.setInterval(function () {
                var post = that.getPost();
                that.view.showPost(post);
            }, that.postInterval);
            that.view.showPost(firstPost);
        });
        this.api.refreshNew();
    };

    RedditBigSpy.prototype.getPost = function () {
        if (Math.random() <= this.percentNew) {
            return this.api.newPost();
        }
        return this.api.hotPost();
    };


    /* MAIN */

    $(function () {
        var app = new RedditBigSpy();
        app.start();
    });
}(window.jQuery, window.tinycolor));
