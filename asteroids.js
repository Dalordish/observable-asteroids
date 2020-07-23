"use strict";
function asteroids() {
    const svg = document.getElementById("canvas");
    generateTitleScreen(svg);
}
const generateTitleScreen = (svgElem) => {
    const svg = document.getElementById("canvas");
    let g = new Elem(svg, 'g').attr("transform", getTransformStringFromXYR(300, 300, 90, 5));
    let play = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:lime;stroke:purple;stroke-width:1");
    play.observe('mousedown').takeUntil(play.observe('mouseup'))
        .map((_) => play.delete())
        .subscribe(initGame);
};
const doPlayerMovement = (ship, action) => action == 'KeyD' ? editRot(ship, 30) :
    action == 'KeyA' ? editRot(ship, -30) :
        action == 'KeyW' ? applyAcceleration(ship, 30) : ship;
function initGame() {
    const player = createSpaceship(300, 300, 170);
    let actionList = [];
    const keyUp = Observable.fromEvent(document, 'keyup')
        .filter((e) => e.code == 'KeyW' || e.code == 'KeyA' || e.code == 'KeyS' || e.code == 'KeyD' || e.code == 'Space');
    const keyDown = Observable.fromEvent(document, 'keydown')
        .filter((e) => e.code == 'KeyW' || e.code == 'KeyA' || e.code == 'KeyS' || e.code == 'KeyD' || e.code == 'Space');
    const actions = keyDown.filter((event) => false || !event.repeat)
        .map((event) => event.code)
        .subscribe((action) => actionList.push(action));
    const gameLoop = Observable.interval(10)
        .map(time => actionList)
        .scan({
        ship: player,
        asteroids: [createRandomAsteroid(), createRandomAsteroid(), createRandomAsteroid()],
        lasers: [],
        score: 1,
        lives: 3,
        level: 1
    }, (acc, actionList) => update(acc, actionList))
        .map(game => {
        actionList = [];
        return game;
    })
        .subscribe(updateDOMFromGame);
}
const update = (game, actions) => {
    console.log(document.currentScript);
    if (game.ship.dead) {
        console.log('ded');
        return game;
    }
    else {
        const actedShip = actions.reduce((acc, action) => doPlayerMovement(acc, action), game.ship);
        const newLasers = actions.filter(input => input == 'Space').map(_ => createLaser(actedShip.x, actedShip.y, actedShip.rot));
        const aliveAsteroids = game.asteroids.filter(obj => !obj.dead);
        const aliveLasers = game.lasers.filter(obj => !obj.dead);
        const velocitiedShip = nextState(10)(actedShip);
        const velocitiedAsteroids = aliveAsteroids.map((asteroid) => nextState(10)(asteroid));
        const allLasers = aliveLasers.concat(newLasers).map(nextState(50))
            .map((laser) => laser.lifespan < 0 ? setDead(laser) : laser);
        const deadAsteroids = velocitiedAsteroids.filter(asteroid => allLasers.filter(laser => collide(laser, asteroid)).length != 0)
            .map((asteroid => setDead(asteroid)));
        const babyAsteroids = deadAsteroids.map((asteroid) => asteroid.size > 0.4 ?
            [createAsteroid(asteroid.x, asteroid.y, getRandBetween(0, 360), asteroid.size - 0.25), createAsteroid(asteroid.x, asteroid.y, getRandBetween(0, 360), asteroid.size - 0.25), createAsteroid(asteroid.x, asteroid.y, getRandBetween(0, 360), asteroid.size - 0.25)] : [])
            .reduce((acc, input) => acc.concat(input), []);
        const leftDeadAndBabyAsteroids = babyAsteroids.concat(deadAsteroids);
        const remainingAsteroids = velocitiedAsteroids.filter(asteroid => allLasers.filter(laser => collide(laser, asteroid)).length == 0);
        const deadLasers = allLasers.filter(laser => velocitiedAsteroids.filter(asteroid => collide(laser, asteroid)).length != 0)
            .map((laser => setDead(laser)));
        const remainingLasers = allLasers.filter(laser => velocitiedAsteroids.filter(asteroid => collide(laser, asteroid)).length == 0);
        const endAsteroids = remainingAsteroids.length < 3 ? remainingAsteroids.concat(createRandomAsteroid(), leftDeadAndBabyAsteroids) : remainingAsteroids.concat(leftDeadAndBabyAsteroids);
        const isPlayerHit = velocitiedAsteroids.filter((asteroid) => collide(asteroid, velocitiedShip))
            .length != 0 ? true : false;
        const updatedLives = isPlayerHit ? game.lives - 1 : game.lives;
        const newGame = {
            ship: updatedLives == 0 ? setDead(velocitiedShip) : velocitiedShip,
            asteroids: isPlayerHit ? endAsteroids.map(a => setDead(a)) : endAsteroids,
            lasers: remainingLasers.concat(deadLasers),
            score: game.score + deadAsteroids.length,
            lives: updatedLives,
            level: remainingAsteroids.length < 3 ? game.level + 1 : game.level
        };
        return newGame;
    }
};
const getTransformStringFromXYR = (x, y, rot, size) => { return "translate(" + x + " " + y + ") rotate(" + rot + ")" + " scale(" + size + ")"; };
const getTransformString = (obj) => getTransformStringFromXYR(obj.x, obj.y, obj.rot, obj.size);
const decomposeRotIntoXY = (rot, magnitude) => [magnitude * .3 * Math.cos((rot - 90) * (Math.PI / 180)), magnitude * .3 * Math.sin((rot - 90) * (Math.PI / 180))];
const getDeltaVelocity = (obj) => decomposeRotIntoXY(obj.rot, 5);
const getRandBetween = (min, max) => Math.random() * (max - min) + min;
const setX = (obj, newX) => {
    const x = newX > 600 ? newX - 600 : newX < 0 ? newX + 600 : newX;
    return Object.assign({}, obj, { x: x });
};
const setY = (obj, newY) => {
    const y = newY > 600 ? newY - 600 : newY < 0 ? newY + 600 : newY;
    return Object.assign({}, obj, { y: y });
};
const setRot = (obj, newRot) => {
    return Object.assign({}, obj, { rot: newRot });
};
const setDead = (obj) => {
    return Object.assign({}, obj, { dead: true });
};
const setLifespan = (obj, lifespan) => Object.assign({}, obj, { lifespan: lifespan });
const setVelocity = (obj, newXvel, newYvel) => Object.assign({}, obj, { velocityX: newXvel, velocityY: newYvel });
const editX = (obj, deltaX) => setX(obj, obj.x + deltaX);
const editY = (obj, deltaY) => setY(obj, obj.y + deltaY);
const editRot = (obj, deltaRot) => setRot(obj, obj.rot + deltaRot);
const editVelocity = (obj, detlaXvel, deltaYvel) => setVelocity(obj, obj.velocityX + detlaXvel, obj.velocityY + deltaYvel);
const editLifespan = (obj, deltaLifespan) => setLifespan(obj, obj.lifespan + deltaLifespan);
const applyAcceleration = (obj, magnitude) => {
    const xyvals = decomposeRotIntoXY(obj.rot, magnitude);
    return editVelocity(obj, xyvals[0], xyvals[1]);
};
const nextState = (timeDelta) => (obj) => {
    const objX = setX(obj, obj.x + obj.velocityX * (timeDelta / 100));
    const objY = setY(objX, objX.y + objX.velocityY * (timeDelta / 100));
    return objY.lifespan != undefined ? editLifespan(objY, -timeDelta) : objY;
};
const collide = (item1, item2) => boundingCollide(item1, item2);
const boundingCollide = (item1, item2) => {
    return (item1.x < item2.x + item2.width &&
        item1.x + item1.width > item2.x &&
        item1.y < item2.y + item2.height &&
        item1.y + item2.height > item2.y);
};
function createLaser(x, y, rot) {
    const svg = document.getElementById("canvas");
    const g = new Elem(svg, 'g')
        .attr("transform", getTransformStringFromXYR(x, y, rot, 1));
    const laser = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-2,-10 -2,10 2,10 -2, 10")
        .attr("style", "fill:purple;stroke:purple;stroke-width:1");
    const velocites = decomposeRotIntoXY(rot, 30);
    return {
        x: x,
        y: y,
        velocityX: velocites[0],
        velocityY: velocites[1],
        rot: rot,
        DOMElement: g,
        SVGElement: laser,
        lifespan: 5000,
        type: 'laser',
        width: 5,
        height: 10,
        dead: false,
        size: 1
    };
}
const createRandomAsteroid = () => createAsteroid(getRandBetween(-200, 200), getRandBetween(-200, 200), getRandBetween(0, 360), getRandBetween(0.25, 1));
function createAsteroid(x, y, rot, size) {
    const svg = document.getElementById("canvas");
    const g = new Elem(svg, 'g')
        .attr("transform", getTransformStringFromXYR(x, y, rot, size));
    const asteroidSVG = new Elem(svg, 'polygon', g.elem)
        .attr("points", '1, -40  30,-40 41,-14 50,20 31,41, 3,50 -27,33 -50,16 -48,-12, -26 -31')
        .attr("style", "fill:black;stroke:purple;stroke-width:1");
    const velocites = decomposeRotIntoXY(rot, 30);
    return {
        x: x,
        y: y,
        velocityX: velocites[0],
        velocityY: velocites[1],
        rot: rot,
        DOMElement: g,
        SVGElement: asteroidSVG,
        type: 'asteroid',
        width: 80 * size,
        height: 80 * size,
        dead: false,
        size: size
    };
}
const createSpaceship = (x, y, rot) => {
    const svg = document.getElementById("canvas");
    let g = new Elem(svg, 'g').attr("transform", getTransformStringFromXYR(x, y, rot, 1));
    let ship = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:lime;stroke:purple;stroke-width:1");
    return {
        x: x,
        y: y,
        velocityX: 0,
        velocityY: 0,
        rot: rot,
        DOMElement: g,
        SVGElement: ship,
        type: 'spaceship',
        width: 20,
        height: 40,
        dead: false,
        size: 1
    };
};
const updateDOM = (obj) => {
    obj.dead ? obj.SVGElement.delete() :
        obj.DOMElement.attr("transform", getTransformString(obj));
    return obj;
};
const updateDOMFromGame = (game) => {
    updateDOM(game.ship);
    game.lasers.map(laser => updateDOM(laser));
    game.asteroids.map(asteroid => updateDOM(asteroid));
    game.ship.dead ? alert("You died!" + " You horrifically destroyed: " + game.score + ' asteroid(s)' + " You reached: Level " + game.level) : '';
};
const getAsteroidPoints = (size, points = 8) => {
    const coords = [...Array(points)].map(_ => [getRandBetween(-size, size), getRandBetween(-size, size)]);
    return coords.sort((a, b) => {
        return (Math.pow(coords[0][0] - a[0], 2) + Math.pow(coords[0][1] - a[1], 2))
            - (Math.pow(coords[0][0] - b[0], 2) + Math.pow(coords[0][1] - b[1], 2));
    });
};
const getAsteroidString = (asteroidPoints) => {
    return asteroidPoints.reduce((acc, curr) => acc + " " + curr[0].toString() + "," + curr[1].toString(), "");
};
if (typeof window != 'undefined')
    window.onload = () => {
        asteroids();
    };
//# sourceMappingURL=asteroids.js.map