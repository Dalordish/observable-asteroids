// FIT2102 2019 Assignment 1
// https://docs.google.com/document/d/1Gr-M6LTU-tfm4yabqZWJYg-zTjEVqHKKTCvePGCYsUA/edit?usp=sharing
/*
return observable with observable of gameobjects/game state and event times
update position each time

game flow: 

asteroids
    |
    |
    v
generateTitleScreen
    |
    | click the button
    V
initGame
    |
    v
observable for keypresses -> mutable array of inputs
    |
    v
observable game timer
    |
    v
update function

*/

interface gameObject {
  x:number,
  y:number,
  velocityX:number
  velocityY:number
  rot:number
  DOMElement:Elem
  SVGElement:Elem
  lifespan?: number
  size:number
  type:string
  width:number
  height:number
  dead:boolean
}

interface game {
  ship:gameObject
  asteroids:gameObject[]
  lasers:gameObject[]
  score:number
  lives:number
  level:number
}
function asteroids() {
  // Inside this function you will use the classes and functions 
  // defined in svgelement.ts and observable.ts
  // to add visuals to the svg element in asteroids.html, animate them, and make them interactive.
  // Study and complete the Observable tasks in the week 4 tutorial worksheet first to get ideas.

  // You will be marked on your functional programming style
  // as well as the functionality that you implement.
  // Document your code!  
  // Explain which ideas you have used ideas from the lectures to 
  // create reusable, generic functions.

  //make SVG rect
  const svg = document.getElementById("canvas")!;
  generateTitleScreen(svg);
}   
const generateTitleScreen = (svgElem:HTMLElement) =>  {

  const svg = document.getElementById("canvas")!;
  let g = new Elem(svg,'g').attr("transform",getTransformStringFromXYR(300,300,90,5)) 
  // create a polygon shape for the space ship as a child of the transform group
  let play = new Elem(svg, 'polygon', g.elem) 
    .attr("points","-15,20 15,20 0,-20")
    .attr("style","fill:lime;stroke:purple;stroke-width:1")
    play.observe<MouseEvent>('mousedown').takeUntil(play.observe('mouseup'))
  .map( (_) => play.delete())
  .subscribe(initGame)
}
const doPlayerMovement = (ship:gameObject,action:string) => 
action == 'KeyD' ? editRot(ship,30) :
action == 'KeyA' ? editRot(ship,-30) :
action == 'KeyW' ? applyAcceleration(ship,30) : ship

function initGame() {
  /* The way initGame works is using two observables in parallel
    
    We begin by subscribing to keydowns and filtering them so they only emit the first keydown. This is to create the button tapping behaviour rather than key repeat behaviour
    Then, we append the items to a mutable list, so that the values can be accessed by the timer observable. A better way to do this would be using merge, for example, but that wasn't implemented due to lack of time. Maybe in future refactors?

    The observable interval handles the main thrust of the logic. Actions are resolved inside update, which emits a new game state, which is then passed to an impure function that renders the entire svg canvas.

  */
  const player = createSpaceship(300,300,170);
  let actionList:string[] = [] // MUTABLE: LIST OF ACTIONS TAKEN IN ONE TICK
  // THE BETTER WAY TO DO THIS WOULD BE WITH A MERGE

  const keyUp = Observable.fromEvent<KeyboardEvent>(document,'keyup')
  .filter( (e) => e.code =='KeyW' || e.code == 'KeyA' || e.code =='KeyS' || e.code == 'KeyD' ||e.code =='Space')

  const keyDown = Observable.fromEvent<KeyboardEvent>(document, 'keydown')
  .filter( (e) => e.code =='KeyW' || e.code == 'KeyA' || e.code =='KeyS' || e.code == 'KeyD' ||e.code =='Space')
  
  const actions = keyDown.filter( (event) => false || !event.repeat) 
  // get the behaviour that only taps work, and only get wasd Space
  .map( (event:KeyboardEvent) => event.code) // map the keycodes as actions
  .subscribe( (action) => actionList.push(action)) //mutably push to the action array

  const gameLoop = Observable.interval(10)
  .map(time => actionList)
  .scan( {
    ship:player,
    asteroids:[createRandomAsteroid(),createRandomAsteroid(),createRandomAsteroid()],
    lasers:[],
    score:1,
    lives:3,
    level:1
    } , (acc:game,actionList) => update(acc,actionList) ) //update the game tick
  .map( game => {
    actionList = []
    return game
  })
  .subscribe(updateDOMFromGame)
}



const update = (game:game, actions:string[]) => {
  console.log(document.currentScript)
  if(game.ship.dead) {
    console.log('ded')
    return game
  }
  else {
  /* PROCESS PLAYER ACTIONS */
  const actedShip = actions.reduce( (acc,action) => doPlayerMovement(acc,action),game.ship)
  const newLasers = actions.filter( input => input == 'Space').map(  _ => createLaser(actedShip.x,actedShip.y,actedShip.rot) )

  /* REMOVE DEAD ITEMS */
  const aliveAsteroids = game.asteroids.filter( obj => !obj.dead)
  const aliveLasers = game.lasers.filter( obj => !obj.dead)

  /* GAME TIME TICK */
  const velocitiedShip = nextState(10)(actedShip)
  const velocitiedAsteroids = aliveAsteroids.map( (asteroid) => nextState(10)(asteroid))
  const allLasers = aliveLasers.concat(newLasers).map(nextState(50))
                          .map( (laser) => laser.lifespan < 0 ? setDead(laser) : laser)
  /* COLLISIONS */
  const deadAsteroids:gameObject[] = velocitiedAsteroids.filter( asteroid => allLasers.filter( laser => collide(laser,asteroid)).length != 0  )
  .map( (asteroid => setDead(asteroid)))

  const babyAsteroids = deadAsteroids.map( (asteroid) => asteroid.size > 0.4 ? 

  [createAsteroid(asteroid.x,asteroid.y,getRandBetween(0,360),asteroid.size-0.25),createAsteroid(asteroid.x,asteroid.y,getRandBetween(0,360),asteroid.size-0.25),createAsteroid(asteroid.x,asteroid.y,getRandBetween(0,360),asteroid.size-0.25)] : [])
  .reduce ( (acc,input) => acc.concat(input), [])
  const leftDeadAndBabyAsteroids = babyAsteroids.concat(deadAsteroids)
  const remainingAsteroids = velocitiedAsteroids.filter( asteroid => allLasers.filter( laser => collide(laser,asteroid)).length == 0  )
  // lasers
  const deadLasers:gameObject[] = allLasers.filter( laser => velocitiedAsteroids.filter( asteroid => collide(laser,asteroid)).length != 0  )
  .map( (laser => setDead(laser)))
  const remainingLasers = allLasers.filter( laser => velocitiedAsteroids.filter( asteroid => collide(laser,asteroid)).length == 0  )

  // add the two and also maybe make new
  const endAsteroids = remainingAsteroids.length < 3 ? remainingAsteroids.concat(createRandomAsteroid(),leftDeadAndBabyAsteroids) : remainingAsteroids.concat(leftDeadAndBabyAsteroids)


  const isPlayerHit = velocitiedAsteroids.filter( (asteroid) => collide(asteroid,velocitiedShip))
                                      .length != 0 ? true : false;
  const updatedLives = isPlayerHit ? game.lives - 1 : game.lives
  

  // return the new game state after one tick
  const newGame = {
    ship:updatedLives == 0 ? setDead(velocitiedShip) :velocitiedShip, //check if the ship is dead and if so set it
    asteroids:isPlayerHit ? endAsteroids.map( a => setDead(a)) : endAsteroids, //check if the asteroids are dead and if so set them
    lasers:remainingLasers.concat(deadLasers), // pass the full list of dead lasers
    score:game.score + deadAsteroids.length,
    lives: updatedLives,
    level:remainingAsteroids.length < 3 ? game.level + 1 : game.level // update the game level if there were less than 3 asteroids
  }
  //console.log(newGame)
  return newGame
  }
}

/* Functions for interacting with svgs */

const getTransformStringFromXYR = (x:number,y:number,rot:number,size:number) =>
 {return "translate(" + x + " " + y + ") rotate(" + rot + ")" + " scale(" + size +")"}
const getTransformString = (obj:gameObject) =>  getTransformStringFromXYR(obj.x,obj.y,obj.rot,obj.size)

/* velocity thrust functions */
const decomposeRotIntoXY = (rot:number,magnitude:number) =>
 [magnitude * .3 * Math.cos((rot-90) * (Math.PI/180)),magnitude * .3 * Math.sin((rot-90) * (Math.PI/180))]
const getDeltaVelocity = (obj:gameObject) =>  decomposeRotIntoXY(obj.rot,5)

/* random number generator */
const getRandBetween = (min:number,max:number) => Math.random() * (max - min) + min;


/*--------------------------------*/

/** pure setters and editors of gameObjects, return a new object each */


const setX = (obj:gameObject,newX:number) => {
  const x = newX > 600 ? newX - 600 : newX < 0 ? newX + 600: newX
  return Object.assign({},obj,{x:x})
}

const setY = (obj:gameObject,newY:number) => {
  const y = newY > 600 ? newY - 600 : newY < 0 ? newY + 600: newY
  return Object.assign({},obj,{y:y})
}

const setRot = (obj:gameObject,newRot:number) => {
  return Object.assign({},obj,{rot:newRot})
}

const setDead = (obj:gameObject)  =>{
  return Object.assign({},obj,{dead:true})
}

const setLifespan = (obj:gameObject,lifespan:number) => Object.assign({},obj,{lifespan:lifespan})
const setVelocity = (obj:gameObject,newXvel:number,newYvel:number) => Object.assign({},obj,{velocityX:newXvel,velocityY:newYvel})


/* EDITORS: THESE TAKE IN DELTA AND USE THE SET FUNCTION ON THE OBJECT */
const editX = (obj:gameObject,deltaX:number):gameObject =>   setX(obj,obj.x + deltaX)
const editY = (obj:gameObject,deltaY:number):gameObject =>   setY(obj,obj.y + deltaY)
const editRot = (obj:gameObject,deltaRot:number):gameObject => setRot(obj,obj.rot + deltaRot)
const editVelocity = (obj:gameObject,detlaXvel:number,deltaYvel:number):gameObject => setVelocity(obj,obj.velocityX + detlaXvel,obj.velocityY + deltaYvel)
const editLifespan = (obj:gameObject,deltaLifespan:number) => setLifespan(obj,obj.lifespan +deltaLifespan)
const applyAcceleration = (obj:gameObject,magnitude:number) => {
  const xyvals = decomposeRotIntoXY(obj.rot,magnitude)
  return editVelocity(obj,xyvals[0],xyvals[1])
}
/* update tick for lifespan and velocity*/ 
//closured, because at times we want to pass in a timeDelta before we actually apply it
const nextState = (timeDelta:number) =>  (obj:gameObject) => {
  const objX = setX(obj,obj.x+obj.velocityX*(timeDelta/100))
  const objY = setY(objX,objX.y+objX.velocityY*(timeDelta/100))
  return objY.lifespan != undefined ? editLifespan(objY,-timeDelta): objY
}

/** PURE HELPER FUNCTIONS */


/* Functions for collision */
const collide = (item1:gameObject,item2:gameObject) => boundingCollide(item1,item2)

const boundingCollide = (item1:gameObject,item2:gameObject) => {
  return (item1.x < item2.x + item2.width &&
   item1.x + item1.width > item2.x &&
   item1.y < item2.y + item2.height &&
   item1.y + item2.height > item2.y)
}




/********IMPURE **************************************** */
/* Object creators */
/* THESE ARE IMPURE AND CREATE SVGs */
function createLaser(x:number,y:number,rot:number):gameObject {
  const svg = document.getElementById("canvas")!;
  const g = new Elem(svg,'g')
  .attr("transform",getTransformStringFromXYR(x,y,rot,1)) 
  const laser = new Elem(svg, 'polygon', g.elem) 
  .attr("points","-2,-10 -2,10 2,10 -2, 10")
  .attr("style","fill:purple;stroke:purple;stroke-width:1")

  const velocites = decomposeRotIntoXY(rot,30)
  return {
    x:x,
    y:y,
    velocityX:velocites[0],
    velocityY:velocites[1],
    rot:rot,
    DOMElement:g,
    SVGElement:laser,
    lifespan:5000,
    type:'laser',
    width:5,
    height:10,
    dead:false,
    size:1
  }
}

const createRandomAsteroid = () => createAsteroid(getRandBetween(-200,200),getRandBetween(-200,200),getRandBetween(0,360),getRandBetween(0.25,1))

function createAsteroid(x:number,y:number,rot:number,size:number):gameObject {
  const svg = document.getElementById("canvas")!;
  const g = new Elem(svg,'g')
  .attr("transform",getTransformStringFromXYR(x,y,rot,size))
  const asteroidSVG = new Elem(svg, 'polygon', g.elem) 
  .attr("points",'1, -40  30,-40 41,-14 50,20 31,41, 3,50 -27,33 -50,16 -48,-12, -26 -31')
  .attr("style","fill:black;stroke:purple;stroke-width:1")

  const velocites = decomposeRotIntoXY(rot,30)
  return {
    x:x,
    y:y,
    velocityX:velocites[0],
    velocityY:velocites[1],
    rot:rot,
    DOMElement:g,
    SVGElement:asteroidSVG,
    type:'asteroid',
    width:80*size,
    height:80*size,
    dead:false,
    size:size
  }
}
const createSpaceship = (x:number,y:number,rot:number):gameObject => {
  const svg = document.getElementById("canvas")!;
  let g = new Elem(svg,'g').attr("transform",getTransformStringFromXYR(x,y,rot,1)) 
  // create a polygon shape for the space ship as a child of the transform group
  let ship = new Elem(svg, 'polygon', g.elem) 
    .attr("points","-15,20 15,20 0,-20")
    .attr("style","fill:lime;stroke:purple;stroke-width:1")
  return {
    x:x,
    y:y,
    velocityX:0,
    velocityY:0,
    rot:rot,
    DOMElement:g,
    SVGElement:ship,
    type:'spaceship',
    width:20,
    height:40,
    dead:false,
    size:1
  }
}
/* Impure, updates the screen to animate objects */
const updateDOM = (obj:gameObject) => {
  obj.dead ? obj.SVGElement.delete() :
  obj.DOMElement.attr("transform",getTransformString(obj))
  return obj
}
const updateDOMFromGame = (game:game) => {
  updateDOM(game.ship)
  game.lasers.map( laser => updateDOM(laser))
  game.asteroids.map(asteroid => updateDOM(asteroid))
  game.ship.dead ? alert("You died!" + " You horrifically destroyed: "+ game.score +' asteroid(s)' + " You reached: Level "+ game.level) : ''
}
/* UNUSED attempt at dynamically generating asteroid polygons */

const getAsteroidPoints = (size:number,points=8) => { 
  const coords = [...Array(points)].map(_ => [getRandBetween(-size,size),getRandBetween(-size,size)])
  return coords.sort( (a,b) => {
  return (Math.pow(coords[0][0] - a[0],2)  + Math.pow(coords[0][1] - a[1],2))
  - (Math.pow(coords[0][0] - b[0],2) + Math.pow(coords[0][1] - b[1],2))
  })
}

// getasteroid string recursively go through
const getAsteroidString = (asteroidPoints:number[][]):string => {
  return asteroidPoints.reduce( (acc,curr) => acc + " " + curr[0].toString() + "," + curr[1].toString(),""  )
}


// get next from current and input
// so we need current
// the following simply runs your asteroids function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
  window.onload = ()=>{
    asteroids();
  }

