class Question {
    eAnswer = null;
    visible = false;
    constructor(elem) {
        let answerText = elem.getAttribute("answer");
        this.eAnswer = document.createElement("answer");
        this.eAnswer.innerText = "Answer: " + answerText;
        elem.insertAdjacentElement("afterend", this.eAnswer);
        elem.addEventListener("click", this.toggle.bind(this));
    }

    toggle() {
        if (this.visible) {
            this.eAnswer.style.display = "none";
            this.visible = false;
        } else {
            this.eAnswer.style.display = "block";
            this.visible = true;
        }
    }
}

document.querySelectorAll("question").forEach(elem => {
    new Question(elem);
});
