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
        this.currPost = undefined;

        this.mode = "posts";
        this._reset();
    };

    RedditApi.prototype._reset = function () {
        this.hot = [];
        this.new = [];
        this.seen = {};
        this.lastHot = undefined;
        this.lastNew = undefined;
    };

    RedditApi.prototype.switchSubreddit = function (subreddit) {
        this.currSubreddit = subreddit;
        this._reset();
    };

    RedditApi.prototype.switchMode = function (mode) {
        this.mode = mode;
        this._reset();
    };

    RedditApi.prototype.searchSubreddits = function (query, callback) {
        var LIMIT = 5;
        var path = "subreddits/search.json?q=" + query + "&limit=" + LIMIT;
        this.apiCall(path, function (response) {
            var results = [];
            response.data.children.forEach(function (sub) {
                results.push(sub.data.display_name);
            });
            callback(results);
        });
    };

    RedditApi.prototype.apiCall = function (path, callback) {
        var apiEndpoint = "//www.reddit.com/" + path;

        $.ajax({
            "url": apiEndpoint,
            "dataType": "jsonp",
            "jsonp": "jsonp",
            "success": function (response) {
                callback(response);
            },
        });
    };

    RedditApi.prototype.refreshHot = function (callback) {
        var path = "", that = this;

        if (this.mode === "posts") {
            if (this.currSubreddit) {
                path += "r/" + this.currSubreddit;
            }

            path += "/hot.json";
            if (this.lastHot) {
                path += "?after=" + this.lastHot;
            }

            this.apiCall(path, function (data) {
                var posts = data.data.children;
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
        } else if (this.mode === "comments") {
            path += this.currPost;

            path += "/hot.json";
            if (this.lastHot) {
                path += "?after=" + this.lastHot;
            }

            this.apiCall(path, function (data) {
                data[1].data.children.forEach(function (comment) {
                    that.hot.push(comment.data);
                    that.seen[comment.name] = true;
                });
            });
        }
    };

    RedditApi.prototype.refreshNew = function (callback) {
        var path = "", that = this;

        if (this.mode === "posts") {
            if (this.currSubreddit) {
                path += "r/" + this.currSubreddit;
            }

            path += "/new.json";
            if (this.lastNew) {
                path += "?after=" + this.lastNew;
            }

            this.apiCall(path, function (data) {
                var posts = data.data.children;
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
        } else if (this.mode === "comments") {
            path += this.currPost;

            path += "/new.json";
            if (this.lastNew) {
                path += "?after=" + this.lastNew;
            }

            this.apiCall(path, function (data) {
                data[1].data.children.forEach(function (comment) {
                    that.new.push(comment.data);
                    that.seen[comment.name] = true;
                });
            });
        }
    };

    RedditApi.prototype.hotItem = function () {
        if (this.hot.length < 5) {
            this.refreshHot();
        }

        if (this.hot.length > 0) {
            return Utils.popRandom(this.hot);
        }
    };

    RedditApi.prototype.newItem = function () {
        if (this.new.length < 5) {
            this.refreshNew();
        }

        if (this.new.length > 0) {
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
                    that.$subredditField.val(that.app.api.currSubreddit);
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
        updatedPercentNew = this.app.percentNew;

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

    RedditBigSpyView.prototype.showItem = function (item) {
        if (!item) {
            console.debug("item is empty");
            return;
        }

        var type = item.subreddit_id.split("_")[0];
        if ((type === "t1" && this.app.api.mode !== "comments") ||
            (type === "t3" && this.app.api.mode !== "posts")) {
            return;
        }

        if (this.app.api.mode === "posts") {
            this.showPost(item);
        } else if (this.app.api.mode === "comments") {
            this.showComment(item);
        }
    };

    RedditBigSpyView.prototype.showComment = function (comment) {
        if (isNaN(comment.ups) || isNaN(comment.downs)) {
            console.log(comment.ups, comment.downs);
            console.error("comment scores were empty");
            return;
        }

        var $li, $row, $score, score;

        $li = $("<li>");
        $row = $("<div class='row feed-item'>");

        // score cell
        score = comment.ups - comment.downs;
        $score = $("<span class='badge'>").text(score);
        $score.css("background-color", this.getPostColor(score));
        $("<div class='col-md-1 score-cell'>").append($score).appendTo($row);

        // body cell
        var $bodyCell = $("<div class='col-md-11'>");
        var bodyText = $($.parseHTML(comment.body_html)).text();
        $bodyCell.html(bodyText).appendTo($row);

        $li.wrapInner($row).hide();
        this.addToFeed($li);
    };

    RedditBigSpyView.prototype.showPost = function (post) {
        var that = this;
        var $li, $row, $score, $postTitle, $subredditLink,
            $subredditLabel, $commentsCell, $commentsLink;

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
        $commentsLink = $("<a class='comment-link'>")
            .data("post-id", post.id)
            .attr("href", "#")
            .text("comments");
        $commentsLink.click(function () {
            that.clear();
            that.app.api.switchMode("comments");
            that.app.api.currPost = "/r/" + post.subreddit + "/comments/" +
                post.id;
            var $button = $("<button>Go back</button>");
            $button.click(function () {
                that.clear();
                that.app.api.switchMode("posts");
                $button.remove();
            });
            $("body > .container").prepend($button);
        });
        $commentsCell = $("<div class='col-md-2 col-lg-1'>")
            .appendTo($row)
            .append($commentsLink);

        $li.wrapInner($row).hide();
        this.addToFeed($li);
    };

    RedditBigSpyView.prototype.addToFeed = function (elem) {
        var MAX_ITEMS = 30;
        var $elem = $(elem).hide();

        this.$feed.prepend($elem);
        $elem.show("drop");

        if (this.$feed.children().length > MAX_ITEMS) {
            this.$feed.children().last().remove();
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
            var firstItem = that.api.hotItem();
            window.setInterval(function () {
                var post = that.getItem();
                that.view.showItem(post);
            }, that.postInterval);
            that.view.showItem(firstItem);
        });
        this.api.refreshNew();
    };

    RedditBigSpy.prototype.getItem = function () {
        if (Math.random() <= this.percentNew / 100.0) {
            return this.api.newItem();
        }
        return this.api.hotItem();
    };


    /* MAIN */

    $(function () {
        var app = new RedditBigSpy();
        app.start();
    });
}(window.jQuery, window.tinycolor));
