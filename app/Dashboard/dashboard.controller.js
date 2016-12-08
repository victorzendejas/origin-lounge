(function() {
    'use strict';

    angular
        .module('app')
        .controller('DashboardController', DashboardController);

    DashboardController.$inject = [
        'DashboardFactory',
        'chatFactory',
        'storageFactory',
        'Idle',
        '$state',
        '$rootScope',
        'chatServerURLAndPort'];

    
    function DashboardController(
        DashboardFactory,
        chatFactory,
        storageFactory,
        Idle,
        $state,
        $rootScope,
        chatServerURLAndPort) {
        
        var vm = this;

        vm.logOut = logOut;

        vm.deleteContentFromACategory = deleteContentFromACategory;

        vm.getContentByCategoryId = getContentByCategoryId;
        vm.getContentByContentId = getContentByContentId;

        activate();

        function activate() {
            // connect to socket.io server
            $rootScope.socket = io.connect(chatServerURLAndPort);
            // this starts watching for idle. This also starts the Keepalive service by default.
            Idle.watch();

            //grabs username and userId from local storage and binds to view
            vm.username = storageFactory.getLocalStorage('userSession').user.userName;
            vm.userId = storageFactory.getLocalStorage('userSession').user.userId;
            
            //grabs roles from local storage
            var roles = storageFactory.getLocalStorage('userSession').roles;

            // array to store the roleIds
            var roleIds = [];

            for (var i = 0; i < roles.length; i++) {

                roleIds.push(roles[i].RoleId);
            }

            // see if the user logged in is an admin or not
            vm.isAdmin = storageFactory.getLocalStorage('isAdmin');

            // get all categories for the specific role of the user that is logged in
            DashboardFactory.getCategoryNamesByRoleId(roleIds).then(

                function(response) {
                
                    // bind categories to the view
                    vm.categories = response;
                    console.log(response);

                    // get all the Roles that exist in the origin.API DB
                    getRoles();
                
                },

                function(error){

                    console.log(error);
                    
                    // get all the Roles that exist in the origin.API DB
                    getRoles();

                });

            
        }

        function deleteContentFromACategory(contentCategoryId) {

            // remove content from contentcategory table

            DashboardFactory.deleteContentCategoryEntry(contentCategoryId).then(

                function(response){

                // remove content from local content array

                },

                function(error){

                    console.log(error);

                });
        }

        // on-click function that goes to the custom content state and brings along the category ID and name of the category selected
        function getContentByCategoryId(categoryId, categoryName) {


            // display category name to content view
            vm.categoryName = categoryName;

            vm.categoryId = categoryId;

            // get all content associated with the specific category Id
            DashboardFactory.getContentByCategoryId(categoryId).then(

                function(response){

                    vm.content = response;
                    $state.go('main.customcontent');

                },

                function(error){

                    // clear content from custom content view if no content is found for a specific category
                    vm.content = '';
                    $state.go('main.customcontent');

                });
           
        }

        // get the content body and title for a specific content Id
        function getContentByContentId(contentId) {

            DashboardFactory.getContentByContentId(contentId).then(

                function(response){

                    vm.contentTitle = response.title;
                    vm.contentBody = response.bodyDescr;

                    $state.go('main.customcontent.customcontentbody');

                },

                function(error){


                });


        }

        // grabs all the roles from the origin.api database
        function getRoles(){

            DashboardFactory.getRoles().then(

                function(response) {

                    vm.roles = response;
                    console.log(response);

                    // get all the Users that exist in the origin.API DB
                    getUsers();

                },

                function(error) {

                    console.log(error);
                
                });

        }

        function getUsers() {

            DashboardFactory.getUsers().then(

                function(response) {

                    vm.users = response;
                    console.log(response);
                    getChatsForAUser();
                },

                function(error) {

                    console.log(error);
                });
        }

        function getChatsForAUser() {

            // get all chat rooms/private messages that the user is subscribed to
            chatFactory.getChatsForAUser(vm.userId).then(

                function(response) {
                    vm.numberOfChannels = 0;
                    vm.numberOfDirectMessages = 0;
                    // display chatgroups on the view           
                    $rootScope.chatGroups = response;
                    
                    // determine how many chat channels and direct messages the user is subscribed to
                    for (var i = 0; i < response.length; i++) {
                        if (response[i].groupType !== "direct") {
                            vm.numberOfChannels++;
                        } else {
                            vm.numberOfDirectMessages++;
                        }
                    }

                        // send socket.io server the full list of chat rooms the user is subscribed to
                        chatFactory.emit('add user', {chatGroups: $rootScope.chatGroups, userid: vm.userId});

                    //jump to calendar state
                    $state.go('main.calendar');
                },

                function(error) {

                     //jump to calendar state
                    $state.go('main.calendar');                   

            });

        }

       
        // Logout on-click function
        function logOut(){
            // // disconnect any chat socket that may be opened, before logging out
            $rootScope.socket.disconnect();
            
            // clear local storage
            storageFactory.clearAllLocalStorage();
            // go to login page
            $state.go('login');
        }

        // **********************************************************************************
        // This is where we register all the socket listeners. This works if there is no way
        // for the user to navigate back to the main state from another state, after they have logged in. As soon as
        // the code changes to allow the user to navigate back to the main state from other states,
        // you will now see these listeners register each time we come back to main state. This will
        // create a situation where each time the users comes to the main state, another set of these listeners will be
        // registered. This will manifest itself in many ways, one of which is the user seeing what they type show up 
        // as many times as these events are registered. So if they were registered twice, the user will see the message
        // twice.
        // **********************************************************************************

        // socket.io listener for connect event that signifies that client has connected to server
        chatFactory.on('connect', function(){

            console.log("Client connected to server"); 
        });

        // socket.io listener for when server emits 'logged in' event
        // this grabs the latest snapshot of clients that are registered on the socket.io server
        // this will also inform the current client if any other clients have logged in
        chatFactory.on('logged in', function(msg){
          // store all the clients that are currently registered in the socket.io server
          $rootScope.usersLoggedIn = msg.users;

           // if the client has already navigated to the chat state (which is where $rootScope.participants is first defined)
           // then find the user that just logged in and mark them as logged in
          if ($rootScope.participants !== undefined) {

              for (var i = 0; i < $rootScope.participants.length; i++) {
                    if ($rootScope.participants[i].userid === msg.userLoggedIn) {
                        $rootScope.participants[i].isLoggedIn = true;
                        $rootScope.usersOnlineAndSubscribedToChatRoom++;
                        }                 
                } 
            }
        });

        // socket.io listener to capture a chat message coming from the server
        chatFactory.on('chat message', function(msg){
          // only add the incoming chat message to the chat if the incoming roomid from the server matches the roomid of the chat you are in
          if ($rootScope.chatid === msg.chatid){
            $rootScope.messages.push(msg);
          }
        });

        // socket.io listener to capture file info coming from the server
        chatFactory.on('receive file info', function(msg){

            if ($rootScope.chatid === msg.chatid) {
                $rootScope.messages.push(msg);
                // get latest snapshot of files associated with the chatroom 
                 chatFactory.getAllFilesSharedInAChatRoom($rootScope.chatid).then(
                    
                    function(response) {

                      console.log("Response from getAllFilesSharedInAChatRoom" + response);
                      $rootScope.filesSharedInChatRoom = response;
                      $rootScope.numberOfFilesSharedInChatRoom = response.length;
                    },

                    function(error){

                      console.log("Error from getAllFilesSharedInAChatRoom" + error);
                    }
                );
             }
        });


        // socket.io listener for when server emits 'logged out' event
        // this grabs the latest snapshot of clients that are registered on the socket.io server
        // this will also inform the current client if any other clients have logged out
        chatFactory.on('logged out', function(msg){
           console.log(msg.userLoggedOut + ' has logged out'); 
           // store all the clients that are currently registered in the socket.io server
           $rootScope.usersLoggedIn = msg.users;

           // if the client has already navigated to the chat state (which is where $rootScope.participants is first defined)
           // then find the user that just logged out and mark them as logged out 
           if ($rootScope.participants !== undefined) {
               for (var i = 0; i < $rootScope.participants.length; i++){
                    if ($rootScope.participants[i].userid === msg.userLoggedOut) {
                        $rootScope.participants[i].isLoggedIn = false;
                        $rootScope.usersOnlineAndSubscribedToChatRoom--;
                    }
               }
           }
        });

        // socket.io listener for when server informs client that another client just created a room that they are part of
        chatFactory.on('notify chatroom created', function(msg){
            console.log(msg);
            // inform socket.io server to add this client to this chat room
            chatFactory.emit('create chatroom', msg);
           
        });
        // socket.io listener for when server informs client that they have been added to the chat room
        chatFactory.on('chatroom created', function(msg){
            console.log(msg);
            // update clients local list of chatgroups they are a part of
           $rootScope.chatGroups.push(msg);  
        });
    }
})();