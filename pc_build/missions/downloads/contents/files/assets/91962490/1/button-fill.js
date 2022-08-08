class ButtonFill extends pc.ScriptType {
    initialize() {
        this._incrementCount = 0;

        this.entity.on("increment", this.incrementFill, this);
    }

    incrementFill() {
        const maskHeight = this.fillGroup.element.height;
        const singleIncrementHeight = maskHeight / this._incrementCount;

        this._popButton();

        // Move mask up and child down for the same y value.
        this.fillGroup.translateLocal(0, singleIncrementHeight, 0);
        this.fillGroup.children[0].translateLocal(0, -singleIncrementHeight, 0);
    }

    _popButton() {
        const startScale = 1;
        const finalScale = 1.2;

        const value = { value: 0 };

        this.app.tween(value)
            .to({ value: 1 }, 0.1, pc.Linear)
            .yoyo(true)
            .repeat(2)
            .on("update", () => {
                const lerpScale = pc.math.lerp(startScale, finalScale, value.value);

                this.entity.parent.setLocalScale(lerpScale, lerpScale, 1);
            })
            .on("complete", () => {
                // res();
            })
            .start();
    }
}

pc.registerScript(ButtonFill);

Object.defineProperty(ButtonFill.prototype, "incrementCount", {
    get: function () {
        return this._incrementCount;
    },

    set: function (value) {
        this._incrementCount = value;
    }
});

ButtonFill.attributes.add("fillGroup", { type: "entity" });
