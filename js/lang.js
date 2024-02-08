var korean = document.getElementById('ko_click'),
    english = document.getElementById('en_click'),
    ko_txt = document.querySelectorAll('.ko'),
    en_txt = document.querySelectorAll('.en'),
    nb_ko = ko_txt.length,
    nb_en = en_txt.length;

korean.addEventListener('click', function() {
    langue(korean, english);
    // Store the selected language in localStorage
    localStorage.setItem('selectedLanguage', 'ko');
}, false);

english.addEventListener('click', function() {
    langue(english, korean);
    // Store the selected language in localStorage
    localStorage.setItem('selectedLanguage', 'en');
}, false);

function langue(langueOn, langueOff) {
    if (!langueOn.classList.contains('current_lang')) {
        langueOn.classList.toggle('current_lang');
        langueOff.classList.toggle('current_lang');
    }
    if (langueOn.innerHTML == '한') {
        afficher(ko_txt, nb_ko);
        cacher(en_txt, nb_en);
    } else if (langueOn.innerHTML == 'EN') {
        afficher(en_txt, nb_en);
        cacher(ko_txt, nb_ko);
    }
}

function afficher(txt, nb) {
    for (var i = 0; i < nb; i++) {
        txt[i].style.display = 'block';
    }
}

function cacher(txt, nb) {
    for (var i = 0; i < nb; i++) {
        txt[i].style.display = 'none';
    }
}

function init() {
    // Retrieve the selected language from localStorage
    var selectedLanguage = localStorage.getItem('selectedLanguage');
    // Set the initial language based on the retrieved value
    if (selectedLanguage === 'ko') {
        langue(korean, english);
    } else if (selectedLanguage === 'en') {
        langue(english, korean);
    } else {
        // If no language is stored, set English as the default
        langue(english, korean);
    }
}

init();
