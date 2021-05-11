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
rhit.FB_KEY_FRIENDS = "friends";
rhit.FB_KEY_USER_ID = "userID";

rhit.Game = class {
    constructor() {
        game = new Chess();
        this.boardPosition = null;
        //TODO: This is broken

        rhit.boardManager.beginListening(this.updateView.bind(this));

        if (rhit.boardManager.gameBoardString) {
            console.log("is the gameBoardStringStart");
            this.boardPosition = rhit.boardManager.gameBoardString;
        }
        this.boardPosition = "start";
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
        // console.log(game);
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
        rhit.boardManager.update(game.fen(), game.game_over(), game.turn() === 'w');
    }
    //white pieces get white png
    pieceTheme(piece) {
        if (piece.search(/w/) !== -1)
            return '/images/chesspieces/' + piece + '.png';
        return 'images/chesspieces/' + piece + '.png';
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
    constructor(gameId) {
        this._documentSnapshot = null;
        this._unsubscribe = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_GAMES).doc(gameId);
    }

    beginListening(changeListener) {
        this._ref.onSnapshot((doc) => {
            if (doc.exists) {
                console.log('doc.data :>> ', doc.data());
                this._documentSnapshot = doc;
                changeListener();
            }
        });
    }
    stopListening() {
        this._unsubscribe();
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

    delete() {
        return this._ref.delete();
    }

    getGameAtIndex(index) {
        const ds = this._documentSnapshot;
        console.log(ds);
    }

    get gameBoardString() {
        if (this._documentSnapshot)
            return this._documentSnapshot.get(rhit.FB_KEY_GAME_BOARD_STRING);
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
    constructor(uid) {
        this._documentSnapshot = null;
        this._unsubscribe = null;
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS).where("uid", "in", this_user.friend_ids)
        this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS).doc(uid);
        this._uid = uid;
    }

    beginListening(changeListener) {
        this._ref.onSnapshot((doc) => {
            if (doc.exists) {
                console.log('doc.data :>> ', doc.data());
                this._documentSnapshot = doc;
                changeListener();
            }
        });
    }

    update(friend) {
        this._ref.update({
                [rhit.FB_KEY_FRIENDS]: friend,
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
        return this._documentSnapshot.get(rhit.FB_KEY_FRIENDS);
    }

}

rhit.FriendController = class {
    constructor() {

        rhit.friendManager.beginListening(this.updateView.bind(this));

        console.log("here");

    }

    updateView() {

        console.log("Makes it to update view from the listener");
        const newList = htmlToElement('<div id="friendPage" class="container page-container friend-page-square"></div>');

        for (let i = 0; i < rhit.friendManager.friends.length; i += 2) {
            let f1 = rhit.friendManager.friends[i];
            let f2 = rhit.friendManager.friends[i + 1];
            console.log(f1, f2);
            let newCard;
            if (f1 && f2)
                newCard = this._populateFriendPage(f1, f2);

            newCard.onclick = (event) => {
                //TODO: Create a new game

                // console.log(`clicked on the card id ${p.id}`);
                // window.location.href = `/photobucket.html?id=${p.id}`;
            };

            newList.appendChild(newCard);
        }

        const oldList = document.querySelector("#friendPage");
        oldList.removeAttribute("id");
        oldList.hidden = true;

        oldList.parentElement.appendChild(newList);
    }

    _populateFriendPage(friend1, friend2) {
        return htmlToElement(`<div class="row friend-row">
        <div class="col text-center"><h3>${friend1}(385) &nbsp; <span class="material-icons">open_in_new</span></h3></div>
        <div class="col text-center"><h3>${friend2}(1025) &nbsp; <span class="material-icons">open_in_new</span></h3></div>
      </div>`);
    }
}

rhit.initializePage = function () {
    const urlParams = new URLSearchParams(window.location.search);
    // const uid = urlParams.get("uid");
    const uid = firebase.auth().currentUser;
    console.log(uid);
    if ($("#mainPage")) {
        const gameId = urlParams.get("gameId");
        if (gameId) {
            rhit.boardManager = new rhit.BoardManager(gameId);
            new rhit.Game();
        }
    }

    if ($("#friendPage")) {
        //once logged in the auth manager is the one to create the user in firestore. 
        // friend page can then only update the users
        if (uid) {
            console.log("theres a uid and it creates both");
            rhit.friendManager = new rhit.FriendManager(uid);
            new rhit.FriendController();
        } else
            console.log("Theres no uid so it doesn't create either");
    }



}


/* Main */
rhit.main = function () {
    rhit.initializePage();
};

rhit.main();