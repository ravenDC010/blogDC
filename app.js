//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const localStrategy = require("passport-local");
//const popup = require("popups");


//var current = new Date();
//var timeStamp = new Date(Date.UTC(current.getFullYear(), current.getMonth(),current.getDate(),current.getHours(), current.getMinutes(),current.getSeconds(), current.getMilliseconds()));

//var moment = require('moment-timezone');

const app = express();

var desc= "";

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());



mongoose.connect("mongodb://localhost:27017/newForumDB", {useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true});

const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    gender: String,
    email: String,
    password: String,
    postID:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],
    commentID:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }]
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    created: Date,
    userID:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    commentID:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }]
});

const Post = new mongoose.model("Post", postSchema);

const commentSchema = new mongoose.Schema({
    content: String,
    created: Date,
    userID:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    postID:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    subComment: String,
    parentCommentID:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    childCommentID:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }]
});

const Comment = new mongoose.model("Comment", commentSchema);

//passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
passport.use(new localStrategy(User.authenticate()));


app.use(function (req, res, next) {
    res.locals.session = req.session;
    next();
}); 

app.get("/", function(req, res){
    if(req.isAuthenticated()){
        desc="Welcome to home page "+req.user.firstName+" "+req.user.lastName+"!";
    }
    else{
        desc="";
    }
    Post.find().populate("userID").exec(function(err, postList){
        if(!err){
            res.render("home", {newPosts: postList});
        }
    });
});

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/login", function(req, res){
    if(req.isAuthenticated()){
        res.redirect("/profile");
    }
    else{
        res.render("login");
    }
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/profile",
    failureRedirect: "/login"
    }),function(req, res){

});

app.post("/register", function(req, res){
    User.register(new User({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        gender: req.body.gender,
        username: req.body.username
    }),
    req.body.password, function(err, user){
        if(err){
            res.redirect("register");
        }
        else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/login");
            });
        }
    });
});

app.get("/profile", function(req, res){
    if(req.isAuthenticated()){
        req.session.loggedin = true;
        // Post.findOne({title: "Location?"}, function(err, post){
        //  Post.findOne({title: "Location?"}, {_id: 0, firstName: 1}).populate("userID", "firstName"). exec(function(err, post){
        //      console.log(post.userID.firstName);
        //  });
        User.findOne({_id: req.user._id}).populate("postID") .exec(function(err, userInfo){
           res.render("profile", {name: req.user.firstName, userData: userInfo});
        });
    }
    else{
        res.redirect("/login");
    }
});

app.get("/logout", function(req, res){
    req.logout();
    req.session.loggedin = false;
    res.redirect("/");
});

app.get("/about", function(req, res){
    if(req.isAuthenticated()){
        desc="Welcome to home page "+req.user.firstName+" "+req.user.lastName+"!";
    }
    else{
        desc="";
    }
    res.render("about", {description: desc});
});

app.get("/contact", function(req, res){
    if(req.isAuthenticated()){
        desc="Welcome to home page "+req.user.firstName+" "+req.user.lastName+"!";
    }
    else{
        desc="";
    }
    res.render("contact", {description: desc});
});

app.get("/write", function(req, res){
    if(req.isAuthenticated()){
        desc="";
        res.render("write", {description: desc, name: req.user.firstName});
    }
    else{
        res.redirect("/login");
    }
});

app.post("/write", function(req, res){
    const post= new Post({
        title: req.body.title,
        content: req.body.content,
        created: new Date(),
        userID: req.user._id
    });

    post.save(function(err){
        if(!err){
            User.findOne({_id: req.user._id}, function(err, user){
                if(!err){
                    user.postID.push(post);
                    user.save();
                }
            })
            res.redirect("/");
        }
        else{
            console.log(err);
        }
    });
});

app.get("/posts/:postId", function(req, res){
    const requestedPostId = req.params.postId;
    Post.findOne({_id: requestedPostId}).populate("userID").populate({
        path: "commentID",
        populate: { path: "childCommentID",
                    populate: { path: "userID"}
                },
    }).populate({
        path: "commentID",
        populate: { path: "userID"}
    }) .exec(function(err, post){
      res.render("post", {
        title: post.title,
        fname: post.userID.firstName,
        lname: post.userID.lastName,
        created: post.created,
        content: post.content,
        postID: requestedPostId,
        commentList: post.commentID

      });
    });
  });

  app.post("/posts/:postId/comments", function(req, res){
    const requestedPostId = req.params.postId;
    const parentComment = req.body.submit;
    console.log(parentComment);
    if( parentComment == "false"){
        console.log("false");
        var comment= new Comment({
            content: req.body.content,
            created: new Date(),
            userID: req.user._id,
            postID: requestedPostId,
            subComment: "false",

        });
    }
    else{   
        console.log("true");
        var comment= new Comment({
            content: req.body.content,
            created: new Date(),
            userID: req.user._id,
            postID: requestedPostId,
            subComment: "true",
            parentCommentID: parentComment
        });
    }

    comment.save(function(err){
        if(!err){
            if(comment.subComment=="true"){
                Comment.findOne({_id: parentComment}, function(err, cmt){
                    if(!err){
                        cmt.childCommentID.push(comment);
                        cmt.save();
                    }
                });
            }

            User.findOne({_id: req.user._id}, function(err, user){
                if(!err){
                    user.commentID.push(comment);
                    user.save();
                }
            });
            Post.findOne({_id: requestedPostId}, function(err, post){
                if(!err){
                    post.commentID.push(comment);
                    post.save();
                }
            });
            console.log(requestedPostId);
            res.redirect("/posts/"+requestedPostId);
        }
        else{
            console.log(err);
        }
    });
  });


app.listen(3000, function(){
    console.log("Server is running");
});