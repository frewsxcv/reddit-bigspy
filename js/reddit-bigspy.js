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


    /* RedditApi */

    var RedditApi = function () {
        this.currSubreddit = undefined;

        this.hot = [];
        this.lastHot = undefined;

        this.new = [];
        this.lastNew = undefined;

        this.seen = {};
    };

    RedditApi.prototype.switchSubreddit = function (subreddit) {
        this.currSubreddit = subreddit;
        this.hot = [];
        this.new = [];
    };

    RedditApi.prototype.apiCall = function (path, callback) {
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

    RedditApi.prototype.refreshHot = function (callback) {
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

    RedditApi.prototype.refreshNew = function (callback) {
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

    RedditApi.prototype.hotPost = function () {
        if (this.hot.length < 5) {
            this.refreshHot();
        }

        if (this.hot.length > 0) {
            return Utils.popRandom(this.hot);
        }
    };

    RedditApi.prototype.newPost = function () {
        if (this.hot.length < 5) {
            this.refreshNew();
        }

        if (this.hot.length > 0) {
            return Utils.popRandom(this.new);
        }
    };


    /* Reddit BigSpy view */

    var RedditBigSpyView = function (app) {
        this.app = app;

        this.$feed = $("#feed");
        this.$settingsDialog = $("#settings-dialog");
        this.$settingsButton = $("#settings-button");
        this.$percentNewSlider = $("#percent-new-slider");
        this.$percentNew = $("#percent-new");
        this.$percentPopular = $("#percent-popular");

        this.setupSettings();
    };

    RedditBigSpyView.prototype.setupSettings = function () {
        var that = this;

        // settings button/dialog

        this.$settingsDialog.dialog({
            "autoOpen": false,
            "buttons": {
                "Cancel": function () {
                },
                "Save": function () {
                },
            },
        });

        this.$settingsButton.click(function () {
            that.$settingsDialog.dialog("open");
        });


        // percent new/popular sliders/text

        this.$percentNewSlider.slider({"value": this.app.percentNew});
        this.$percentNew.text(this.app.percentNew);
        this.$percentPopular.text(100 - this.app.percentNew);

        this.$percentNewSlider.on("slide", function (evt, ui) {
            that.$percentNew.text(ui.value);
            that.$percentPopular.text(100 - ui.value);
            that.app.percentNew = ui.value;
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
        this.api = new RedditApi();
        this.percentNew = 20;
        this.postInterval = 2000;

        this.view = new RedditBigSpyView(this);
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
        if (Math.random() <= this.percentNew / 100.0) {
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
