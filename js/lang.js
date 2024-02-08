var korean = document.getElementById('ko_click'),
    english = document.getElementById('en_click'),
    ko_txt = document.querySelectorAll('.ko'),
    en_txt = document.querySelectorAll('.en'),
    nb_ko = ko_txt.length,
    nb_en = en_txt.length;

korean.addEventListener('click', function() {
    langue(korean,english);
}, false);

english.addEventListener('click', function() {
    langue(english,korean);
}, false);

function langue(langueOn,langueOff){
    if (!langueOn.classList.contains('current_lang')) {
        langueOn.classList.toggle('current_lang');
        langueOff.classList.toggle('current_lang');
    }
    if(langueOn.innerHTML == '한'){
        afficher(ko_txt, nb_ko);
        cacher(en_txt, nb_en);
    }
    else if(langueOn.innerHTML == 'EN'){
        afficher(en_txt, nb_en);
        cacher(ko_txt, nb_ko);
    }
}

function afficher(txt,nb){
    for(var i=0; i < nb; i++){
        txt[i].style.display = 'block';
    }
}
function cacher(txt,nb){
    for(var i=0; i < nb; i++){
        txt[i].style.display = 'none';
    }
}
function init(){
    langue(korean,english);
}
init();