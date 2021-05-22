/**
 * @fileoverview
 * Provides the JavaScript interactions for all the pages.
 *
 * @author 
 * David Purdy
 */

var rhit = rhit || {};
var board = null;
var game = null;
var gid = null;
var gblackPlayer = null;
var gwhitePlayer = null;
var gboardString = null;
var gisOver = null;
var gisWhiteTurn = null;
var gorientation = null;
var currUser = null;

rhit.FB_COLLECTION_GAMES = "games";
rhit.FB_COLLECTION_USERS = "users";
rhit.FB_KEY_BLACK_USER = "blackPlayerUser";
rhit.FB_KEY_WHITE_USER = "whitePlayerUser";
rhit.FB_KEY_GAME_BOARD_STRING = "gameBoardString";
rhit.FB_KEY_IS_OVER = "isOver";
rhit.FB_KEY_IS_WHITE = "isWhiteTurn";
rhit.FB_KEY_WHITE_SCORE = "whiteScore";
rhit.FB_KEY_BLACK_SCORE = "blackScore";
rhit.FB_KEY_USER_FRIENDS = "friends";
rhit.FB_KEY_USER_ID = "userId";
rhit.FB_KEY_USER_GAME_ID_LIST = "gameIdList";
rhit.FB_KEY_USER_NAME = "username";
rhit.FB_KEY_USER_EMAIL = "email";

rhit.Game = class {

    constructor(id, g) {
        game = new Chess();
        // console.log("print when it makes a new game", g);
        gid = id;
        gwhitePlayer = g.whitePlayerUser;
        gblackPlayer = g.blackPlayerUser;
        gboardString = g.gameBoardString;
        gisOver = g.isOver;
        gisWhiteTurn = g.isWhiteTurn;
        game.load(gboardString);
        gorientation = "white";
        console.log("black user", g.blackPlayerUser);
        currUser = rhit.authManager.user.email;
        if (gblackPlayer == currUser)
            gorientation = "black";
        this.initializeBoard();
    }

    initializeBoard() {
        // console.log(this._boardString);
        if (game) {
            var config = {
                draggable: true,
                pieceTheme: this.pieceTheme,
                position: this._boardString,
                onDragStart: this.onDragStart,
                onDrop: this.onDrop,
                onMouseoutSquare: this.onMouseoutSquare,
                onMouseoverSquare: this.onMouseoverSquare,
                onSnapEnd: this.onSnapEnd,
                orientation: this._orientation
            }
            if (document.getElementById("mainPage")) {
                board = Chessboard('myBoard', config)
            }
        }
        board.position(gboardString);
        console.log("new board position", gboardString);
    }

    onDragStart(source, piece) {
        // do not pick up pieces if the game is over
        if (game.game_over()) return false;
        // or if it's not that side's turn
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }

        // console.log(currUser + game.turn());
        if (currUser != gwhitePlayer && game.turn() === 'w')
            return false;
        else if (currUser != gblackPlayer && game.turn() === 'b')
            return false
    }

    onDrop(source, target) {
        removeGreySquares();

        // see if the move is legal
        var move = game.move({
            from: source,
            to: target,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        });

        // illegal move
        if (move === null) return 'snapback';
    }

    onMouseoverSquare(square, piece) {
        // get list of possible moves for this square
        var moves = game.moves({
            square: square,
            verbose: true
        });

        // exit if there are no moves available for this square
        if (moves.length === 0) return;

        // highlight the square they moused over
        greySquare(square);

        // highlight the possible squares for this piece
        for (var i = 0; i < moves.length; i++) {
            greySquare(moves[i].to);
        }
    }

    onMouseoutSquare(square, piece) {
        removeGreySquares();
    }

    onSnapEnd() {
        // const id = new URLSearchParams(window.location.search).get("id");
        // console.log(game.fen() + " " + game.game_over() + " " + game.turn() === 'w');
        board.position(game.fen());
        rhit.boardManager.update(gid, game.fen(), game.game_over(), game.turn() === 'w');
        if (game.game_over()) {
            //TODO: ADD end of game for if they are the current user or not
            rhit.boardManager.remove(gid, gwhitePlayer, gblackPlayer);
            alert("game over ! ");
        }

    }
    //white pieces get white png
    pieceTheme(piece) {
        if (piece.search(/w/) !== -1)
            return '/images/chesspieces/' + piece + '.png';
        return 'images/chesspieces/' + piece + '.png';
    }

    get boardString() {
        return this._boardString;
    }
    get whitePlayer() {
        return this._whitePlayer;
    }
    get blackPlayer() {
        return this._blackPlayer;
    }

}

function removeGreySquares() {
    $('#myBoard .square-55d63').css('background', '');
}

function greySquare(square) {
    var $square = $('#myBoard .square-' + square);
    var background = '#a9a9a9';
    if ($square.hasClass('black-3c85d')) {
        background = '#696969';
    }
    $square.css('background', background);
}

function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    return template.content.firstChild;
}

rhit.BoardManager = class {
    constructor() {
        this._documentSnapshots = [];
        this._unsubscribe = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_GAMES);
        this._userSnap = null;
    }

    createNewGame(player1, player2) {
        let white, black;
        if (Math.random() < 0.5) {
            white = player1;
            black = player2;
        } else {
            black = player1
            white = player2;
        }
        this.add(white, black);
    }

    remove(id, white, black) {
        let q = firebase.firestore().collection(rhit.FB_COLLECTION_USERS);
        q.where("email", "==", white).limit(1).get().then((query) => {
            query.docs[0].ref.update({
                [rhit.FB_KEY_USER_GAME_ID_LIST]: firebase.firestore.FieldValue.arrayRemove(id),
            });
        });
        q.where("email", "==", black).limit(1).get().then((query) => {
            query.docs[0].ref.update({
                [rhit.FB_KEY_USER_GAME_ID_LIST]: firebase.firestore.FieldValue.arrayRemove(id),
            });
        });
    }


    add(white, black) {

        // console.log("resetting the board at that location");
        this._ref.add({
                [rhit.FB_KEY_WHITE_USER]: white,
                [rhit.FB_KEY_BLACK_USER]: black,
                [rhit.FB_KEY_IS_WHITE]: true,
                [rhit.FB_KEY_IS_OVER]: false,
                [rhit.FB_KEY_GAME_BOARD_STRING]: "start",
                [rhit.FB_KEY_WHITE_SCORE]: 0,
                [rhit.FB_KEY_BLACK_SCORE]: 0
            }).then(docRef => {
                let q = firebase.firestore().collection(rhit.FB_COLLECTION_USERS);
                q.where("email", "==", white).limit(1).get().then((query) => {
                    query.docs[0].ref.update({
                        [rhit.FB_KEY_USER_GAME_ID_LIST]: firebase.firestore.FieldValue.arrayUnion(docRef.id),
                    });
                });
                q.where("email", "==", black).limit(1).get().then((query) => {
                    query.docs[0].ref.update({
                        [rhit.FB_KEY_USER_GAME_ID_LIST]: firebase.firestore.FieldValue.arrayUnion(docRef.id),
                    });
                });

            })
            .catch(function (error) {
                console.log("error", error);
            });
    }

    update(id, gameBoardString, isOver, isWhiteTurn) {
        this._ref.doc(id).update({
                [rhit.FB_KEY_GAME_BOARD_STRING]: gameBoardString,
                [rhit.FB_KEY_IS_OVER]: isOver,
                [rhit.FB_KEY_IS_WHITE]: isWhiteTurn,
            })
            .then(function () {
                console.log("updated sucessfully", gameBoardString);
            })
            .catch(function (error) {
                console.log("error", error);
            });
    }

    async getGameById(id) {
        let x = this._ref.doc(id).get().then((doc) => {
            return doc.data();
        });
        return x;
    }

    beginListening(changeListener) {
        this._unsubscribe = this._ref.limit(10).onSnapshot((querySnapshot) => {
            this._documentSnapshots = querySnapshot.docs;
            changeListener();
        });
    }

    stopListening() {
        this._unsubscribe();
    }

    getGameAtIndex(index) {
        const ds = this._documentSnapshots[index];
        const g = new rhit.Game(
            ds.id,
            ds.get(rhit.FB_KEY_WHITE_USER),
            ds.get(rhit.FB_KEY_BLACK_USER),
            ds.get(rhit.FB_KEY_IS_WHITE),
            ds.get(rhit.FB_KEY_IS_OVER)
        );
        return g;
    }

    get gameBoardString() {
        if (this._documentSnapshot) {
            this._documentSnapshot.get(rhit.FB_KEY_GAME_BOARD_STRING);
            console.log("this is the board here ", x);
            return x;
        } else {
            console.log("document snapshot doesn't exist yet");
        }
    }

    get isWhiteTurn() {
        return this._documentSnapshot.get(rhit.FB_KEY_IS_WHITE);
    }

    get isOver() {
        return this._documentSnapshot.get(rhit.FB_KEY_IS_OVER);
    }

    get whitePlayer() {
        return this._documentSnapshot.get(rhit.FB_KEY_WHITE_USER);
    }

    get blackPlayer() {
        return this._documentSnapshot.get(rhit.FB_KEY_BLACK_USER);
    }

    getGames() {
        return this._userSnap.get(rhit.FB_KEY_USER_GAME_ID_LIST);
    }

}

rhit.GamePageManager = class {
    constructor() {
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS)
        this._unsubscribe = null;
    }

    beginListening(changeListener) {
        let query = this._ref.where("email", "==", rhit.authManager.user.email);
        this._unsubscribe = query.onSnapshot((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                this._snapshot = doc;
                if (changeListener)
                    changeListener();
            });
        });
    }

    stopListening() {
        this._unsubscribe();
    }

    get games() {
        return this._snapshot.get(rhit.FB_KEY_USER_GAME_ID_LIST);
    }
}

rhit.FriendManager = class {
    constructor() {
        this._snapshot = null;
        this._unsubscribe = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS);
    }

    beginListening(changeListener) {
        let query = this._ref.where("email", "==", rhit.authManager.user.email);
        this._unsubscribe = query.onSnapshot((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                this._snapshot = doc;
                if (changeListener)
                    changeListener();
            });
        });
    }

    update(friend) {
        this._ref.where("email", "==", rhit.authManager.user.email).limit(1).get().then((query) => {
            query.docs[0].ref.update({
                [rhit.FB_KEY_USER_FRIENDS]: firebase.firestore.FieldValue.arrayUnion(friend),
            });
        });
    }

    verifyExists(friend) {
        let query = firebase.firestore().collection(rhit.FB_COLLECTION_USERS).where(rhit.FB_KEY_USER_EMAIL, "==", friend);
        let bool;
        query.get().then((querySnapshot) => {
            // console.log("here");
            if (querySnapshot.length > 0)
                bool = true;
        })
        return bool;
    }

    stopListening() {
        this._unsubscribe();
    }

    get friends() {
        return this._snapshot.get(rhit.FB_KEY_USER_FRIENDS);
    }

}

rhit.AuthManager = class {
    constructor() {
        this._documentSnapshot = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS);
    }

    beginListening(changeListener) {
        firebase.auth().onAuthStateChanged((user) => {
            changeListener();

        });
    };

    signOut() {
        firebase.auth().signOut()
            .catch(function (error) {
                console.log("Sign Out Error");
            });
    };

    //add account to the firestore if it doesn't already exist 
    addAccountToFirestore(user) {
        // console.log("User", user);
        let email = null;
        if (user.email)
            email = user.email;
        let username = email.substr(0, email.indexOf('@'));
        // console.log("Username ", username);
        this.add(user, username);
    };

    add(user, username) {
        this._ref.add({
            [rhit.FB_KEY_USER_ID]: user.uid,
            [rhit.FB_KEY_USER_NAME]: username,
            [rhit.FB_KEY_USER_EMAIL]: user.email,
            [rhit.FB_KEY_USER_FRIENDS]: [],
            [rhit.FB_KEY_USER_GAME_ID_LIST]: []
        }).then((docRef) => {
            this._documentSnapshot = docRef;
            console.log("user added successfully");
        }).catch((error) => {
            console.log("error in adding user");
        });
    }

    get isSignedIn() {
        return !!firebase.auth().currentUser;
    }

    get user() {
        return firebase.auth().currentUser;
    }

    get uid() {
        return this._documentSnapshot.id;
    }
}

rhit.FriendController = class {
    constructor() {
        $("#signOutButton").click(() => {
            rhit.authManager.signOut();
        });

        $("#addFriendDialog").on("show.bs.modal", (event) => {
            document.querySelector("#inputEmail").value = "";
        });

        $("#addFriendDialog").on("show.bs.modal", (event) => {
            document.querySelector("#inputEmail").focus();
        });

        $("#submitAddFriend").click(() => {
            const friendEmail = document.querySelector("#inputEmail").value;
            rhit.friendManager.update(friendEmail);
        });
        rhit.friendManager.beginListening(this.updateView.bind(this));
    }

    updateView() {
        const newList = htmlToElement(`<div id="friendList"></div>`);
        // console.log("friends ", rhit.friendManager.friends);
        for (let i = 0; i < rhit.friendManager.friends.length; i++) {
            let f1 = rhit.friendManager.friends[i];
            // console.log(f1);
            let newCard;
            if (f1)
                newCard = this._populateFriendPage(f1);

            newCard.onclick = (event) => {
                // console.log("the button has been clicked");
                // console.log(rhit.authManager.user.email);
                rhit.boardManager.createNewGame(rhit.authManager.user.email, f1);
                //TODO: Tell users they created a new game
                // window.location.href = `/main.html?id=${ rhit.boardManager.docId}`;
            };

            newList.appendChild(newCard);
        }

        const oldList = document.querySelector("#friendList");
        oldList.removeAttribute("id");
        oldList.hidden = true;
        oldList.parentElement.appendChild(newList);
    }

    _populateFriendPage(friend1) {
        return htmlToElement(`<div class="row friend-row">
        <div class="col text-center" data-friend="${friend1}"><h3>${friend1}&nbsp; <span class="material-icons">open_in_new</span></h3></div>
      </div>`);
    }
}

rhit.LoginController = class {
    constructor() {


    }
}

rhit.MainPageController = class {
    constructor() {
        $("#signOutButton").click(() => {
            rhit.authManager.signOut();
        });
        rhit.boardManager.beginListening(this.updateView.bind(this));
    }

    updateView() {
        // console.log("it is getting to the update view");
        document.querySelector("#playerLabel").innerHTML = `${gwhitePlayer}`;
        document.querySelector("#opponentLabel").innerHTML = `${gblackPlayer}`;
    }
}

rhit.GamePageController = class {
    constructor() {
        $("#signOutButton").click(() => {
            rhit.authManager.signOut();
        });
        // console.log("game page constructed");
        rhit.gamePageManager.beginListening(this.updateView.bind(this));
    }

    async updateView() {
        const newList = htmlToElement(`<div id="gamePage" class="container page-container game-page-square"></div>`);
        for (let i = 0; i < rhit.gamePageManager.games.length; i++) {
            let newCard;
            let g1 = await rhit.boardManager.getGameById(rhit.gamePageManager.games[i]);
            console.log(g1);
            if (g1) {
                let w = g1.whitePlayerUser.substr(0, g1.whitePlayerUser.indexOf('@'));
                let b = g1.blackPlayerUser.substr(0, g1.blackPlayerUser.indexOf('@'));
                newCard = this._populateGamePage(g1, w, b);
            }
            newCard.onclick = (event) => {
                // rhit.currentGame = new rhit.Game(g1);
                window.location.href = `/main.html?id=${rhit.gamePageManager.games[i]}`;
            };
            newList.appendChild(newCard);
        }

        const oldList = document.querySelector("#gamePage");
        oldList.removeAttribute("id");
        oldList.hidden = true;
        oldList.parentElement.appendChild(newList);
    }

    _populateGamePage(g1, w, b) {
        return htmlToElement(`<div class="row friend-row">
        <div id="${g1.id}" class="col text-center" data-friend="${g1.id}"><h3>${w} vs. ${b} &nbsp; <span class="material-icons">open_in_new</span></h3></div>
      </div>`);
    }
}



rhit.checkForRedirects = function () {


    //this is too fast and it won't put stuff in the database? 
    // if (document.querySelector("#loginPage") && rhit.authManager.isSignedIn) {
    //     window.location.href = "/main.html";
    // }

    if (!document.querySelector("#loginPage") && !rhit.authManager.isSignedIn) {
        window.location.href = "/";
    }
};

rhit.firebaseui = function () {
    var uiConfig = {
        callbacks: {
            signInSuccessWithAuthResult: function (authResult, redirectUrl) {
                //if it is a new user add them to firestore users
                console.log("signs in successfully", authResult.additionalUserInfo.isNewUser);

                if (authResult.additionalUserInfo.isNewUser)
                    rhit.authManager.addAccountToFirestore(authResult.user);
                return true;
            }
        },
        signInSuccessUrl: '/friends.html',
        signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            firebase.auth.EmailAuthProvider.PROVIDER_ID
        ]
    };
    var ui = new firebaseui.auth.AuthUI(firebase.auth());
    ui.start('#firebaseui-auth-container', uiConfig);
}


rhit.initializePage = async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const uid = firebase.auth().currentUser;

    if (document.querySelector("#mainPage")) {
        const gameId = urlParams.get("id");
        if (gameId) {
            // console.log("is hitting here again");
            let g = await rhit.boardManager.getGameById(gameId);
            // console.log("getting the object ", g);
            rhit.currentGame = new rhit.Game(gameId, g);
            new rhit.MainPageController();
        }
    }

    if (document.querySelector("#friendPage")) {
        if (uid) {
            rhit.friendManager = new rhit.FriendManager();
            new rhit.FriendController();
        } else
            console.log("There is no uid so the friend manager is not created");
    }

    if (document.querySelector("#gamePage")) {
        rhit.gamePageManager = new this.GamePageManager();
        new rhit.GamePageController();
    }


    if (document.querySelector("#loginPage")) {
        rhit.firebaseui();
    }


}

/* Main */
rhit.main = function () {
    rhit.authManager = new rhit.AuthManager();
    rhit.boardManager = new rhit.BoardManager();

    rhit.authManager.beginListening(() => {
        rhit.checkForRedirects();
        rhit.initializePage();
    });
};

rhit.main();