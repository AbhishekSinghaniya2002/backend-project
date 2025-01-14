import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
/*
1.  We make a separate method for generateAccessAndRefreshTokens
2. yaha par asyncHandler likhne ki jarurat nahi hai kyunki vo jab hum web request handle karte hai tab likhte hai. yaha par hamara internal method hai to async se ka use karenge.
3. yaha apr hame userId easily mil jayega kyunki is stape par hamne user vali sari chije check kar li hogi to user se aram se mill jayega.
*/
 

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        // jab bhi method ko call karte hai  to () lagate hai .

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return{ accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
        
    }
}




const registerUser = asyncHandler(async (req , res)=> {
    // I have written all the stapes

   // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


// get user details from frontend
const {fullName, email, username, password} = req.body
// console.log("fullName: ", fullName);
// console.log("email: ", email);
// console.log("username: ", username);
// console.log("password: ", password);


if (
    [fullName, email, username, password].some((field) =>
         field?.trim() === "")
    
) {
    throw new ApiError(400, "All fields are required")
}


// check if user already exists: username, email
const existedUser = await User.findOne({
    $or: [{ username }, { email }]
})

if (existedUser) {
    throw new ApiError(409, "User with email or username already exists")
    
}
// console.log(req.files);
 // check for images, check for avatar
const avatarLocalPath = req.files?.avatar[0]?.path;
// const coverImageLocalPath = req.files?.coverImage[0]?.path; ye wrong hai
//  (const coverImage = coverImageLocalPath ?  await uploadOnCloudinary(coverImageLocalPath) : null)  ye sahi hai
// const coverImageLocalPath = res?.files?.coverImage?.[0]?.path ye bhi sahi hai
let coverImageLocalPath;
if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path
}

if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")    
}

 // upload them to cloudinary, avatar
 const avatar = await uploadOnCloudinary(avatarLocalPath)
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)

 if (!avatar) {
    throw new ApiError(400, "Avatar file is required")
    
 }

 // create user object - create entry in db
 const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
 })

 // remove password and refresh token field from response
    // check for user creation
 const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
 )
 if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user")
    
 }

 // Agar user properly ban gaya hai to response me bhej do sabko vapas return res
return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered Successfully")
)

})

// login part start
const loginUser = asyncHandler(async(req , res)=> {
     // req body -> data
    // username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie

    // 1.req body -> data
const { username, email, password } = req.body
console.log(email);
// 2. username or email
if (!username && !email) {
    throw new ApiError(400 , "username or email is required")
}
// here is an alternative of above code we can write both.
// if (!(username || email)) {
//     throw new ApiError(400 , "username or email is required")
// }

//3 . find the user
const user = await User.findOne({
    $or: [{username}, {email}]
})
// agar or laga ke bhi user nahi mila iska matlab user kabhi register tha hi nahi then

// yaha par ye hamare davara banaya gaya user hai na ki jo database me mongoose se mila hai. Vo User is tarah se milta hai.

if (!user) {
    throw new ApiError(404, "User does not exist")
}

//4. Agar sari chije mil jaye to password check

const isPasswordValid = await user.isPasswordCorrect(password)

if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
}

//5. access and refresh token

const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
// .select ka use tab hum karte hai jab hame kisi chij ko nahi lena hai.

const options = {
    httpOnly: true,
    secure: true 
    // ye cookies keval server se modified ho sakta hai frontend se nahi. kyunki yaha true kar diya gaya hai.
}

return res
.status(200)
.cookie("accessToken", accessToken, options)
.cookie("refreshToken", refreshToken, options)
.json(
    new ApiResponse(
        200,
        {
            user: loggedInUser, accessToken, refreshToken
        },
        "User logged In Successfully"
    )
)
})

const logoutUser = asyncHandler(async(req , res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
            
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true,

    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))

})


// Now we make an end point of Refresh access token.
// first we make a controller after that we can make end point

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used ")
            
        }
    
        const {accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
        const options = {
            httpOnly: true,
            secure: true
        }
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
        
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid Old Password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200,{}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse (200, req.user, "current user fetched successfully"))

})

const updateAccountDetails = asyncHandler(async(req , res) => {

    const {fullName, email} = req.body;

    if(!(fullName || email)){
        throw new ApiError(400, "All fields are required")

    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
           $set: {
            fullName,
            email:email
           } 
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

})

// Now we learn how can we update our files. iske liye hum yaha 2 middleware use karenge 1 multer and 2nd is user loggedin hai ki nahi. and iske hisab se route dekh lenge.

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }
      //TODO: delete old image - assignment
    

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{ // set tab lete hai jab hame single chij lena ho
                avatar: avatar.url

            }
        },
        {new: true}

    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,  user, "avatar image updated successfully"))
})

    // Now we update coverImage

    const updateUserCoverImage = asyncHandler(async(req, res) => {
        const coverImageLocalPath = req.file?.path
    
        if (!coverImageLocalPath) {
            throw new ApiError(400, "Cover image file is missing")
        }
    
        //TODO: delete old image - assignment
    
    
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
        if (!coverImage.url) {
            throw new ApiError(400, "Error while uploading on avatar")
            
        }
    
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    coverImage: coverImage.url
                }
            },
            {new: true}
        ).select("-password")
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Cover image updated successfully")
        )
    })

    // Now see how can we do aggregation pipeline or Access chanel information like subscriber , follower , and many more things

    const getUserChannelProfile = asyncHandler(async(req , res) => {

        const {username} = req.params

        if(!username?.trim()){
            throw new ApiError(400, "username is missing")

        }
        const channel = await User.aggregate([
            {
                $match:{
                    username: username?.toLowerCase()

                }// here we found the channel name now we find the subscriber 
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers" 
                    // here we have find out all the subscribers. mean mere kitne subscribers hai ye mil gaya hai yaha par.
                }
            },
            // Ab hum dekhenge ki maine kitno ko subscribed kiya hai. 2nd pipeline.
            {
                $lookup: {
                    from: "subscriptions",
                    localField: _id,
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            // Ab hum upar vale dono field ko Add karenge
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"// yaha hamne $ use kiya hai kyunki ye ab field hai.
                    },
                    channelsSubscribedToCount:{
                        $size: "$subscribedTo"
                    },
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false // yaha hamne dekha ki kya login ke baad jo user hai vaha par usne subscrib kiya hai ya NAHI.
                        }
                    }
                }
            },
// yaha ab hum projection karenge mean projet projection deta hai ki mai sari value ko ekdam se project nahi karunga vaha pe jo bhi usko demand kar raha hai . mai usko selected chije dunga. 
            
            {
                $projects: {
                    fullName: 1,
                    username: 1,
                    email: 1,
                    avatar: 1,
                    coverImage: 1,
                    subscribersCount: 1,
                    channelsSubscribedToCount: 1,
                    isSubscribed: 1,


                }
             }
        ])
        // console.log("User.aggregate");

        // Agar channel ke under data hi nahi hai to bhi check karnA PADEGA.
        if(!channel?.length){
            throw new ApiError(400, "channel does not exists")
        }
        return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "User channel fetched successfully"))

    })
    
    // Now How can we get watch history of User or channel 

    const getWatchHistory = asyncHandler(async(req, res) => {
        const user = await User.aggregate([
            {
                $match:{
                   // _id: req.user._id ye likhenge to ho jayegi problem kyunki yahah mongoose work nahi karta hai. aggregation pipline ka jitna code hai vo directly hi jata hai. Kyunki hum jante hai ki hame mongodb me jo id milta hai vo real me mongodb ki id nahi hoti vo hoti hai string jo hame vaha milta hai. Agar actual me hame mongo db ki id chahiye hota to hame pura ka pura ye _id: ObjectId('6780db6748989jiuy7y') chahiye hota. Lekin hum yaha use kar rahe hai mongoose aur iske under internally ye hota hai jaise hum isko ye string vali  id dete hai to automatically behind the scene ye is string ko convert kar deta hai tab jo hume milta hai vo hota hai Mongodb ki object id. lekin jab hume is id ko convert karna ho tpo kasie karenge vo dekhte hai. chaliye hum mongoose ki object id banata hai.

                   _id: new mongoose.Types.ObjectId(req.user._id)// yahah par vo document or id match ho gaya hai object id se . Ab user mil gaya hai to hame uske watch history ke under jana padega aur lookup karrna padega to lookup karte hai .
                   
                }
            },
            {
                $lookup:{
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    // ab hum us situation par pahuch gaye hai jaha hamare pass bahut sare document aa gaye hai aur vo videos hamare pass aa gaye hai.lekkin problem ye hai ki hame yaha ek sub pipeline lagnai padegi nahi to video section ke owner ka hame kuchh nahi milega. to hum ek aur pipline likhenge. Aur ye lookup ke under hi likh sakte hai hum.
                    pipeline:[
                        {
                            $lookup:{
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",// Ab yahah par array ke under bahut sari value aa gayi hai users ki like: fullname, email, avatar, aur bhi sari chije ye pura to hame dena nahi hai owner ko to hum phir se ek pipeline lagayenge.
                                pipeline:[
                                    {
                                        $project:{
                                            fullName: 1,
                                            username: 1,
                                            avatar: 1,
                                        }
                                    }
                                ]
                            }
                        },// Ab jo array mil rha hai usko aur sahi se handle kar le frontend pe uske liye ek aur pipeline laga raha hu taki chije easily handle ho jaye.
                        {
                            $addFields:{
                                owner:{
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
                
            }

        ])

        return res
        .status(200)
        .json(new ApiResponse(200,user[0].watchHistory,"Watch history fetched successfully"))

    })

    
export{
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,

}