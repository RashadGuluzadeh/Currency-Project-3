let leftbtn = document.querySelectorAll(".from  .buttons-from button");
let rightbtn = document.querySelectorAll(".to  .buttons-from button");
let leftErrorText = document.querySelector(".from .error-text");
let rightErrorText = document.querySelector(".to .error-text");
let btnActive = document.querySelectorAll(".btn-active");
let inputLeft = document.querySelector(".from input");
let inputRight = document.querySelector(".to input");
const url = "https://api.exchangerate.host/latest";
let rateLeft = document.querySelector(".leftvalue");
let leftcurrencyvalue = document.querySelector(".leftvalue");
let rightcurrencyvalue = document.querySelector(".rightvalue");
let currency1, currency2, ratesLeft, ratesRight;
const inputTo = document.querySelector(".to input");
const inputFrom = document.querySelector(".from input")

btnActive.forEach((item, index) => {
  if (index == 0) {
    currency1 = item.value;
  }
  if (index == 1) {
    currency2 = item.value;
  }
});
async function getApi (e) {
  window.addEventListener("offline", () => {
    throw alert("You are offline");
  });
  if(currency1 == currency2){
    inputRight.value = 1
    inputLeft.value = 1
  }
  const _url = new URL('/latest', 'https://api.exchangerate.host');
  _url.searchParams.set('base', currency1);
  _url.searchParams.set('symbols', currency2);
  const responseLeft = await fetch(_url);
  _url.searchParams.set('base', currency2);
  _url.searchParams.set('symbols', currency1);

  const responseRight = await fetch(_url);
  const dataLeft = await responseLeft.json();
  const dataRight = await responseRight.json();
  ratesLeft = await Object.values(dataLeft.rates)[0];
  ratesRight = await Object.values(dataRight.rates)[0];
  showCurrency(e);
  if(e == "right-buttons"){
    if(inputRight.value != ""){
      inputRight.value = Number((inputLeft.value.replace(/\s+/g,"") * ratesLeft).toFixed(6))
      RightInp(inputRight)
    }
    else{
      inputRight.value = ""
    }
  }
  if(e == "left-buttons"){
    if(inputLeft.value != ""){
      inputLeft.value = Number((inputRight.value.replace(/\s+/g,"") * ratesRight).toFixed(6))  
      LeftInp(inputLeft)
    }
    else{
      inputLeft.value = ""
    }
  }
  convert(e)
};

getApi().catch((error) => alert("something wrong"));

// ------------------------- Show Currency -------------------------
function showCurrency(e) {
  leftcurrencyvalue.textContent = `1 ${currency1} = ${ratesLeft} ${currency2}`;
  rightcurrencyvalue.textContent = `1 ${currency2} = ${ratesRight} ${currency1}`;
  
}

function convert(e){  
  inputLeft.addEventListener("keyup", (e) => {
    if (e.target.value == "") {
      leftErrorText.style.display = "none";
      inputRight.value = ""
    } 
    else if (e.target.value.includes(",")) {
      e.target.value = e.target.value.replace(",", ".");
    } 
    else {
      inputRight.value = +(e.target.value.replace(/\s+/g,"") * ratesLeft).toFixed(6);
      leftErrorText.style.display = "none";
      RightInp(inputRight)
    }
  });
  inputRight.addEventListener("keyup", (e) => {
    if (e.target.value == "") {
      rightErrorText.style.display = "none";
      inputLeft.value = ""
    } 
    else if (e.target.value.includes(",")) {
      e.target.value = e.target.value.replace(",", ".");
    } 
    else{
      inputLeft.value = +(e.target.value.replace(/\s+/g,"") * ratesRight).toFixed(6);
      rightErrorText.style.display = "none";
      LeftInp(inputLeft)
    }
  });
}
// ------------------------- Btn Select and get value -------------------------

function leftSelectedCurrency() {
  leftbtn.forEach((element, index) => {
    leftbtn[index].addEventListener("click", function () {
      let leftcurrent = document.querySelectorAll(".from .buttons-from .btn-active");
      leftcurrent[0].className = leftcurrent[0].className.replace(" btn-active","");
      this.className += " btn-active";
      currency1 = element.value;
      console.log(currency1);
      getApi(this.parentElement.classList[1]);
    });
  });
}
leftSelectedCurrency();

function rightSelectedCurrency() {
  rightbtn.forEach((element, index) => {
    rightbtn[index].addEventListener("click", function () {
      let rightcurrent = document.querySelectorAll(".to .buttons-from .btn-active");
      rightcurrent[0].className = rightcurrent[0].className.replace(" btn-active","");
      this.className += " btn-active";
      currency2 = element.value;
      console.log(currency2);
      getApi(this.parentElement.classList[1]);
    });
  });
}
rightSelectedCurrency();

//  ---------------------- Menu bar -----------------------------

const hamburger = document.querySelector(".hamburger")
const menu = document.querySelector(".bar")

hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active")
    menu.classList.toggle("active")
})


function LeftInp(inp){
  var numberMask = IMask(inp, {
    mask: Number,
    scale: 6,  
    signed: false,  
    thousandsSeparator: ' ',  
    padFractionalZeros: false,  
    normalizeZeros: true,  
    radix: '.' ,  
    mapToRadix: ['.'], 
    });
}
LeftInp(inputFrom)
function RightInp(inp){
  var numberMask = IMask(inp, {
    mask: Number,  
    scale: 6,  
    signed: false, 
    thousandsSeparator: ' ',  
    padFractionalZeros: false, 
    normalizeZeros: true,  
    radix: '.',  
    mapToRadix: ['.'],  
  });
}
RightInp(inputTo)
