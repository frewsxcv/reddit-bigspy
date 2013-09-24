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
        this.seen = {};
        this.lastHot = undefined;
        this.lastNew = undefined;
    };

    RedditApi.prototype.searchSubreddits = function (query, callback) {
        var LIMIT = 5;
        var path = "subreddits/search.json?q=" + query + "&limit=" + LIMIT;
        this.apiCall(path, function (response) {
            var results = [];
            response.children.forEach(function (sub) {
                results.push(sub.data.display_name);
            });
            callback(results);
        });
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
        path += "/hot.json";
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
        path += "/new.json";
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

        this.$navbarTitle = $("#navbar-title");
        this.$feed = $("#feed");
        this.$settingsDialog = $("#settings-dialog");
        this.$settingsButton = $("#settings-button");
        this.$percentNewSlider = $("#percent-new-slider");
        this.$percentNew = $("#percent-new");
        this.$percentPopular = $("#percent-popular");
        this.$subredditField = $("#subreddit-field");

        this.setupSettings();
    };

    RedditBigSpyView.prototype.setTitle = function (title) {
        this.$navbarTitle.text(title);
    };

    RedditBigSpyView.prototype.clear = function () {
        var that = this;
        this.$feed.hide("drop", function () {
            that.$feed.empty();
            that.$feed.show("drop");
        });
    };

    RedditBigSpyView.prototype.setupSettings = function () {
        var that = this, updatedPercentNew;

        // settings button/dialog

        this.$settingsDialog.dialog({
            "autoOpen": false,
            "dialogClass": "no-close",
            "buttons": {
                "Cancel": function () {
                    that.updatePercentNewView(that.app.percentNew);
                    that.$subredditField = that.app.api.currSubreddit;
                    $(this).dialog("close");
                },
                "Save": function () {
                    var newSub = $.trim(that.$subredditField.val());
                    var oldSub = that.app.api.currSubreddit || "";
                    var newTitle = "Posts from ";

                    that.app.percentNew = updatedPercentNew;

                    if (newSub !== oldSub) {
                        if (newSub) {
                            newTitle += "/r/" + newSub;
                        } else {
                            newTitle += "all subreddits";
                        }
                        that.setTitle(newTitle);
                        that.app.api.switchSubreddit(newSub);
                        that.clear();
                    }

                    $(this).dialog("close");
                },
            },
        });

        this.$settingsButton.click(function () {
            that.$settingsDialog.dialog("open");
        });


        // percent new/popular sliders/text

        this.updatePercentNewView(this.app.percentNew);

        this.$percentNewSlider.on("slide", function (evt, ui) {
            that.$percentNew.text(ui.value);
            that.$percentPopular.text(100 - ui.value);
            updatedPercentNew = ui.value;
        });


        // autocomplete

        this.$subredditField.autocomplete({
            "source": function (req, res) {
                that.app.api.searchSubreddits(req.term, function (subs) {
                    res(subs);
                });
            },
        });
    };

    RedditBigSpyView.prototype.updatePercentNewView = function (percentNew) {
        this.$percentNewSlider.slider({"value": percentNew});
        this.$percentNew.text(percentNew);
        this.$percentPopular.text(100 - percentNew);
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
                $subredditLabel, $commentsCell;

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
            $("<div class='col-md-9 col-lg-10 title-cell'>")
                .append($subredditLabel)
                .append($postTitle)
                .appendTo($row);

            // comments cell
            $commentsCell = $("<div class='col-md-2 col-lg-1'>")
                .appendTo($row);
            $("<a>")
                .attr("href", "#")
                .text("comments").appendTo($commentsCell);


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
