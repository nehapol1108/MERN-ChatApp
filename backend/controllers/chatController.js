const asyncHandler = require("express-async-handler");
const Chat = require("../Models/chatModel");
const User = require("../Models/userModel");
const accessChat = asyncHandler(async(req,res)=>{
    //userId is of current user
    const {userId} = req.body;
    if(!userId){
        console.log("User Id param not sent with request");
        return res.sendStatus(400);
    }
    console.log(req.user);
    //checking if the chat with the other user exists
    var isChat = await Chat.find({
        isGroupChat:false, //it should not be a group chat
        //we are finding if a chat already exists between the two
        $and:[
            {users:{$elemMatch:{$eq:req.user._id}}}, //the other user
            {users:{$elemMatch:{$eq:userId}}} //current user
        ]
    }).populate("users","-password").populate("latestMessage");

    //for populating sender field from messsage model
    isChat = await User.populate(isChat,{
        path:'latestMessage.sender',
        select:"name pic email",
    });
    //if chat already exists
    if(isChat.length>0){
        res.send(isChat[0]);
    }else{
        //creating new chat
        var chatData = {
            chatName:"sender",
            isGroupChat:false,
            users :[req.user._id,userId],
        };
        try{
            const createdChat = await Chat.create(chatData);
            const FullChat = await Chat.findOne({_id:createdChat._id}).populate("users","-password");
            res.status(200).send(FullChat);
        }catch(err){
            throw new Error(err.message);
        }
    }
});

const fetchChats = asyncHandler(async(req,res)=>{
    try{
        //we are goinf to find inside of users array with how many users 
        //the current user has already chatted with
        Chat.find({users:{$elemMatch:{$eq:req.user._id}}})
        .populate("users","-password")
        .populate("groupAdmin","-password")
        .populate("latestMessage")
        .sort({updatedAt:-1})
        .then(async(results)=>{
            results=await User.populate(results,{
                path:"latestMessage.sender",
                select:"name pic email",
            }) 
            res.status(200).send(results);
        });
    }catch(err){
        res.status(400);
        throw new Error(err.message);
    }
});

const createGroupChat = asyncHandler(async(req,res)=>{
    //it takes array of users to be in the group and the group name
   if(!req.body.users || !req.body.name){
        return res.status(400).send({message:"Please Fill all the fields"});
   }
   //we are parsing the stringify sent from frontend to object in backend
   var users = JSON.parse(req.body.users);
   if(users.length<2){
    return res.status(400).send("More than 2 users are required to form a group chat");
   }
   //pushing the current user
   users.push(req.user);
   try{
        const groupChat = await Chat.create({
            chatName:req.body.name,
            users:users,
            isGroupChat:true,
            groupAdmin:req.user,
        });
        const fullGroupChat = await Chat.findOne({_id:groupChat._id})
        .populate("users","-password")
        .populate("groupAdmin","-password");
        res.status(200).json(fullGroupChat);
   }catch(error){
        res.status(400);
        throw new Error(err.message);
   }
});

const renameGroup = asyncHandler(async(req,res)=>{
   const {chatId,chatName} = req.body;
   const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
        chatName
    },{
        new:true, //to return new name of the group
    }
   )
   .populate("users","-password")
   .populate("groupAdmin","-password");

   if(!updatedChat){
        res.status(404);
        throw new Error("Chat not found");
   }else{
        res.json(updatedChat);
   }
});

const addToGroup = asyncHandler(async(req,res)=>{
   const {chatId,userId} = req.body;
   const added = await Chat.findByIdAndUpdate(chatId,
    {
        $push:{users:userId}
    },
    {new:true}
    )
    .populate("users","-password")
    .populate("groupAdmin","-password");

    if(!added){
        res.status(404);
        throw new Error("Chat not found");
   }else{
        res.json(added);
   }
});
const removeFromGroup = asyncHandler(async(req,res)=>{
    const {chatId,userId} = req.body;
    const removed = await Chat.findByIdAndUpdate(chatId,
     {
         $pull:{users:userId}
     },
     {new:true}
     )
     .populate("users","-password")
     .populate("groupAdmin","-password");
 
     if(!removed){
         res.status(404);
         throw new Error("Chat not found");
    }else{
         res.json(removed);
    }
 });
module.exports={accessChat,fetchChats,createGroupChat,renameGroup,addToGroup,removeFromGroup }