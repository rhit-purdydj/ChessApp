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
    constructor() {
        game = new Chess();
        rhit.singleGameManager.beginListening(this.updateView.bind(this));

        this.boardPosition = rhit.singleGameManger.gameBoardString;

        if (game) {
            var config = {
                draggable: true,
                pieceTheme: this.pieceTheme,
                position: this.boardPosition,
                onDragStart: this.onDragStart,
                onDrop: this.onDrop,
                onMouseoutSquare: this.onMouseoutSquare,
                onMouseoverSquare: this.onMouseoverSquare,
                onSnapEnd: this.onSnapEnd
            }
            if (document.getElementById("mainPage")) {
                board = Chessboard('myBoard', config)
                console.log(board);
            }
        }
    }

    onDragStart(source, piece) {
        // do not pick up pieces if the game is over
        if (game.game_over()) return false;
        // or if it's not that side's turn
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
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
        board.position(game.fen());
        rhit.singleGameManger.update(game.fen(), game.game_over(), game.turn() === 'w');
        if (game.game_over()) {
            //TODO: ADD end of game for if they are the current user or not
        }

    }
    //white pieces get white png
    pieceTheme(piece) {
        if (piece.search(/w/) !== -1)
            return '/images/chesspieces/' + piece + '.png';
        return 'images/chesspieces/' + piece + '.png';
    }

    get boardString() {
        return this.boardPosition;
    }

    updateView() {

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
        this._documentSnapshot = null;
        this._unsubscribe = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_GAMES);
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

    add(white, black) {
        this._unsubscribe = this._ref.add({
                [rhit.FB_KEY_WHITE_USER]: white,
                [rhit.FB_KEY_BLACK_USER]: black,
                [rhit.FB_KEY_IS_WHITE]: true,
                [rhit.FB_KEY_IS_OVER]: false,
                [rhit.FB_KEY_GAME_BOARD_STRING]: "start",
                [rhit.FB_KEY_WHITE_SCORE]: 0,
                [rhit.FB_KEY_BLACK_SCORE]: 0
            }).then(docRef => {
                console.log("game created sucessfully", docRef.id);
                rhit.singleGameManager = new rhit.SingleGameManager(docRef.id, docRef);
                window.location.href = `/main.html?id=${docRef.id}`;
                new rhit.MainPageController();
                new rhit.Game();
            })
            .catch(function (error) {
                console.log("error", error);
            });
    }

    beginListening(changeListener) {
        this._ref.onSnapshot((doc) => {
            if (doc.exists) {
                this._documentSnapshot = doc;
                changeListener();
            }
        });
    }

    stopListening() {
        this._unsubscribe();
    }

    getGameAtIndex(index) {
        const ds = this._documentSnapshot;
        console.log(ds);
    }
}


rhit.SingleGameManager = class {

    constructor(gameId, ref) {
        console.log(gameId);
        this._documentSnapshot = ref;
        this._unsubscribe = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_GAMES).doc(gameId);
        // rhit.game = new rhit.Game();
    }

    beginListening(changeListener) {
        this._ref.onSnapshot((doc) => {
            if (doc.exists) {
                this._documentSnapshot = doc;
                console.log("this is the document snapshot", this._documentSnapshot.get(rhit.FB_KEY_GAME_BOARD_STRING));
                changeListener();
            }
        });
    }

    update(gameBoardString, isOver, isWhiteTurn) {
        this._ref.update({
                [rhit.FB_KEY_GAME_BOARD_STRING]: gameBoardString,
                [rhit.FB_KEY_IS_OVER]: isOver,
                [rhit.FB_KEY_IS_WHITE]: isWhiteTurn,
            })
            .then(function () {
                console.log("updated sucessfully");
            })
            .catch(function (error) {
                console.log("error", error);
            });
    }

    stopListening() {
        this._unsubscribe();
    }

    delete() {
        return this._ref.delete();
    }

    get gameBoardString() {
        if (this._documentSnapshot) {
            let x = this._documentSnapshot.get(rhit.FB_KEY_GAME_BOARD_STRING);
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

}


rhit.FriendManager = class {
    constructor() {
        this._snapshot = null;
        this._unsubscribe = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS).where("email", "==", rhit.authManager.user.email);
    }

    beginListening(changeListener) {
        this._unsubscribe = this._ref.get().then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                this._snapshot = doc;
                if (changeListener)
                    changeListener();
            });
        });
    }

    update(friend) {
        let friends = this._snapshot.get(rhit.FB_KEY_USER_FRIENDS);
        friends.append(friend);
        this._ref.update({
                [rhit.FB_KEY_USER_FRIENDS]: friends,
            })
            .then(function () {
                console.log("updated sucessfully");
            })
            .catch(function (error) {
                console.log("error", error);
            });
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
        console.log("User", user);
        let email = null;
        if (user.email)
            email = user.email;
        let username = email.substr(0, email.indexOf('@'));
        console.log("Username ", username);
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
}

rhit.FriendController = class {
    constructor() {
        $("#signOutButton").click(() => {
            rhit.authManager.signOut();
        });
        rhit.friendManager.beginListening(this.updateView.bind(this));
    }

    updateView() {
        const newList = htmlToElement(`<div id="friendList"></div>`);
        console.log("friends ", rhit.friendManager.friends);
        for (let i = 0; i < rhit.friendManager.friends.length; i++) {
            let f1 = rhit.friendManager.friends[i];
            console.log(f1);
            let newCard;
            if (f1)
                newCard = this._populateFriendPage(f1);

            newCard.onclick = (event) => {
                console.log("the button has been clicked");
                console.log(rhit.authManager.user.email);
                rhit.boardManager.createNewGame(rhit.authManager.user.email, f1);
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
        rhit.singleGameManager.beginListening(this.updateView.bind(this));
    }

    updateView() {
        // console.log("it is getting to the update view");
        document.querySelector("#playerLabel").innerHTML = `${rhit.singleGameManger.whitePlayer}`;
        document.querySelector("#opponentLabel").innerHTML = `${rhit.singleGameManger.blackPlayer}`;
    }
}

rhit.GamePageController = class {
    constructor() {
        $("#signOutButton").click(() => {
            rhit.authManager.signOut();
        });
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
        signInSuccessUrl: '/main.html',
        signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            firebase.auth.EmailAuthProvider.PROVIDER_ID
        ]
    };
    var ui = new firebaseui.auth.AuthUI(firebase.auth());
    ui.start('#firebaseui-auth-container', uiConfig);
}


rhit.initializePage = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const uid = firebase.auth().currentUser;

    if (document.querySelector("#mainPage")) {
        // console.log("main page being created");
        const gameId = urlParams.get("id");
        if (gameId) {
            // rhit.singleGameManger = new rhit.SingleGameManager(gameId);
            new rhit.MainPageController();
            new rhit.Game();
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