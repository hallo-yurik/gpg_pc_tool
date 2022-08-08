class FirstPhaseManager extends pc.ScriptType {
    initialize() {
        this.uiButton.script.ButtonFill.incrementCount = this.worldButtonsArray.length;
        this.buttonsState = Array(this.worldButtonsArray.length).fill(false);

        this.lookAt = new pc.Vec3();
        this.up = new pc.Vec3();

        this.isMoving = false;
        this.detailsCounter = 0;

        // Tutorial.
        this.tutorialIsOn = false;
        this.showCursor = true;
        this.autoclickTimeout = 0;
        this.AUTOCLICK_TIME = 6;
        this.changeFocusTimeout = 0;
        this.CHANGE_FOCUS_TIME = 2;
        this.dontShowTimeout = 0;
        this.DONT_SHOW_TIME = 4;
        this.focusEntityIndex = 0;

        // Attach events for world buttons.
        this.worldButtonsArray.forEach((button, index) => button.element.on("click", () => this.addDetail(index)));
        // Attach event for ui button.
        this.uiButton.element.on("click", this.addNextDetail, this);
    }

    async postInitialize() {
        await new Promise(res => {
            this.app.tween(null)
                .to(null, 1, pc.Linear)
                .on("complete", () => {
                    res();
                })
                .start();
        });

        this.tutorialIsOn = true;
    }

    addNextDetail() {
        const index = this.buttonsState.findIndex(buttonState => !buttonState);

        if (index === -1) return;

        this.addDetail(index);
    }

    async addDetail(index) {
        if (this.buttonsState[index]) return;
        if (this.isMoving) return;

        this.autoclickTimeout = 0;
        this.showCursor = false;
        this.app.fire("TutorialManager:actionDone");

        this.isMoving = true;
        this.buttonsState[index] = true;
        // Increment common button.
        this.uiButton.fire("increment");

        // Disable world button.
        this.worldButtonsArray[index].enabled = false;

        // Move truck to the detail.
        this._rotateTruck(index);
        await this._moveTruck(index);

        // Move detail to the ladle and reparent it.
        await this._moveDetail(index);

        this.detailsCounter++;
        this.textCounter.element.text = `${this.detailsCounter} / ${this.worldButtonsArray.length}`;

        if (this.buttonsState.every(buttonState => buttonState)) {
            this._finishPhase();
        }

        this.isMoving = false;
    }

    async _finishPhase() {
        // Disable ui button.
        this.uiButton.parent.enabled = false;
        this.uiBanner.enabled = false;
        this.tutorialIsOn = false;

        // Move truck by path.
        const curves = this.createCurves(this.truck, this.path);

        const value = { value: 0 };
        const cameraPositionOffset = new pc.Vec3();
        const stateScript = this.app.root.children[0].script.GlobalState;
        const camera = stateScript.mainCamera;

        await new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 2, pc.Linear)
                .on("update", () => {
                    const positionBefore = this.truck.getPosition().clone();
                    this.moveEntity(this.truck, curves, value.value);
                    const positionAfter = this.truck.getPosition();

                    cameraPositionOffset.sub2(positionAfter, positionBefore);
                    camera.translate(cameraPositionOffset);
                })
                .on("complete", () => {
                    value.value = 0;
                    res();
                })
                .start();
        });

        const startRotation = camera.getRotation().clone();
        const newRotation = this.helpCamera.getRotation();
        const lerpRotation = new pc.Quat();

        const startPosition = camera.getPosition().clone();
        const endPosition = this.helpCamera.getPosition();
        const lerpPosition = new pc.Vec3();

        await new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 0.5, pc.Linear)
                .on("update", () => {
                    lerpRotation.slerp(startRotation, newRotation, value.value);
                    lerpPosition.lerp(startPosition, endPosition, value.value);

                    camera.setRotation(lerpRotation);
                    camera.setPosition(lerpPosition);
                })
                .on("complete", () => {
                    res();
                })
                .start();
        });

        this.app.fire("SecondPhaseManager:startPhase");
    }

    _rotateTruck(index) {
        const truckPosition = this.truck.getPosition().clone();
        const detailPosition = this.airplanePartsArray[index].getPosition().clone();
        truckPosition.y = 0;
        detailPosition.y = 0;

        const dirToDetail = new pc.Vec3().sub2(detailPosition, truckPosition).normalize();
        const truckForward = this.truck.forward.clone().mulScalar(-1);
        truckForward.y = 0;
        truckForward.normalize();

        const truckRight = this.truck.right.clone();
        truckRight.y = 0;
        truckRight.normalize();

        const angleBetweenRight = Math.acos(dirToDetail.dot(truckRight)) * pc.math.RAD_TO_DEG;
        const multiplier = angleBetweenRight < 90 ? 1 : -1;

        const angleBetween = Math.acos(dirToDetail.dot(truckForward)) * pc.math.RAD_TO_DEG * multiplier;

        const startQuat = this.truck.getRotation().clone();
        const truckQuat = new pc.Quat().copy(this.truck.getRotation());
        const rotationQuat = new pc.Quat().setFromAxisAngle(this.truck.up, angleBetween);
        truckQuat.mul(rotationQuat);
        const lerpQuat = new pc.Quat();

        const value = { value: 0 };

        this.app.tween(value)
            .to({ value: 1 }, 0.2, pc.Linear)
            .on("update", () => {
                lerpQuat.slerp(startQuat, truckQuat, value.value);
                this.truck.setRotation(lerpQuat);
            })
            .start();
    }

    _moveTruck(index) {
        const DISTANCE_TO_DETAIL = 3;

        const truckPosition = this.truck.getPosition().clone();
        const detailPosition = this.airplanePartsArray[index].getPosition().clone();
        truckPosition.y = 0;
        detailPosition.y = 0;

        const dirToDetail = new pc.Vec3().sub2(detailPosition, truckPosition);
        const oppositDirection = dirToDetail.clone().normalize().mulScalar(-DISTANCE_TO_DETAIL);
        dirToDetail.add(oppositDirection);

        const startPosition = this.truck.getPosition().clone();
        const newPosition = this.truck.getPosition().clone().add(dirToDetail);
        const lerpPosition = new pc.Vec3();

        const value = { value: 0 };

        return new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 0.2, pc.Linear)
                .on("update", () => {
                    lerpPosition.lerp(startPosition, newPosition, value.value);
                    this.truck.setPosition(lerpPosition);
                })
                .on("complete", () => {
                    res();
                })
                .start();
        });
    }

    async _moveDetail(index) {
        const value = { value: 0 };

        const detail = this.airplanePartsArray[index];
        const rotation = detail.getRotation().clone();

        const startDetailPosition = detail.getPosition().clone();
        const ladlePosition = this.ladle.getPosition();
        const lerpPosition = new pc.Vec3();

        return new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 0.1, pc.Linear)
                .on("update", () => {
                    lerpPosition.lerp(startDetailPosition, ladlePosition, value.value);

                    detail.setPosition(lerpPosition);
                })
                .on("complete", () => {
                    detail.reparent(this.ladle);

                    detail.setPosition(ladlePosition);
                    detail.setRotation(rotation);
                    res();
                })
                .start();
        });
    }

    createCurves(entity, pathEntity) {
        const curveMode = pc.CURVE_CARDINAL;

        const path = {
            px: new pc.Curve(),
            py: new pc.Curve(),
            pz: new pc.Curve(),
            tx: new pc.Curve(),
            ty: new pc.Curve(),
            tz: new pc.Curve(),
            ux: new pc.Curve(),
            uy: new pc.Curve(),
            uz: new pc.Curve()
        };

        path.px.type = curveMode;
        path.py.type = curveMode;
        path.pz.type = curveMode;

        path.tx.type = curveMode;
        path.ty.type = curveMode;
        path.tz.type = curveMode;

        path.ux.type = curveMode;
        path.uy.type = curveMode;
        path.uz.type = curveMode;

        const nodes = pathEntity.children;

        // Get the total linear distance of the path (this isn't correct but gives a decent approximation in length)
        let pathLength = 0;

        // Store the distance from the start of the path for each path node
        const nodePathLength = [0];

        // For use when calculating the distance between two nodes on the path
        const distanceBetween = new pc.Vec3();

        // Distance from current position to first node.
        distanceBetween.sub2(entity.getPosition(), nodes[0].getPosition());
        pathLength += distanceBetween.length();
        nodePathLength.push(pathLength);

        for (let i = 1; i < nodes.length; i++) {
            const prevNode = nodes[i - 1];
            const nextNode = nodes[i];

            distanceBetween.sub2(prevNode.getPosition(), nextNode.getPosition());
            pathLength += distanceBetween.length();

            nodePathLength.push(pathLength);
        }

        const t = nodePathLength[0] / pathLength;

        const pos = entity.getPosition();
        path.px.add(t, pos.x);
        path.py.add(t, pos.y);
        path.pz.add(t, pos.z);

        const lookAt = pos.clone().add(entity.forward);
        path.tx.add(t, lookAt.x);
        path.ty.add(t, lookAt.y);
        path.tz.add(t, lookAt.z);

        const up = entity.up;
        path.ux.add(t, up.x);
        path.uy.add(t, up.y);
        path.uz.add(t, up.z);

        for (let i = 0; i < nodes.length; i++) {
            const t = nodePathLength[i + 1] / pathLength;

            const node = nodes[i];

            const pos = node.getPosition();
            path.px.add(t, pos.x);
            path.py.add(t, pos.y);
            path.pz.add(t, pos.z);

            const lookAt = pos.clone().add(node.forward);
            path.tx.add(t, lookAt.x);
            path.ty.add(t, lookAt.y);
            path.tz.add(t, lookAt.z);

            const up = node.up;
            path.ux.add(t, up.x);
            path.uy.add(t, up.y);
            path.uz.add(t, up.z);
        }

        return path;
    }

    moveEntity(entity, curves, value) {
        entity.setPosition(curves.px.value(value), curves.py.value(value), curves.pz.value(value));
        this.lookAt.set(curves.tx.value(value), curves.ty.value(value), curves.tz.value(value));
        this.up.set(curves.ux.value(value), curves.uy.value(value), curves.uz.value(value));
        entity.lookAt(this.lookAt, this.up);
    }

    focusOnDetail(entityToFollow) {
        this.app.fire("TutorialManager:cursorTap", entityToFollow, false);
    }

    update(dt) {
        if (this.tutorialIsOn) {
            if (this.showCursor) {
                this.changeFocusTimeout += dt;
                this.autoclickTimeout += dt;

                if (this.changeFocusTimeout > this.CHANGE_FOCUS_TIME) {
                    this.changeFocusTimeout = 0;

                    // Find next available detail.
                    for (let i = 1; i < this.buttonsState.length + 1; i++) {
                        const nextDetailIndex = (this.focusEntityIndex + i) % this.buttonsState.length;

                        if (!this.buttonsState[nextDetailIndex]) {
                            this.focusEntityIndex = nextDetailIndex;
                            this.focusOnDetail(this.worldButtonsArray[this.focusEntityIndex]);
                            break;
                        }
                    }
                }

                if (this.autoclickTimeout > this.AUTOCLICK_TIME) {
                    this.addNextDetail();
                }
            } else {
                this.dontShowTimeout += dt;

                if (this.dontShowTimeout > this.DONT_SHOW_TIME) {
                    this.focusOnDetail(this.worldButtonsArray[this.focusEntityIndex]);
                    this.dontShowTimeout = 0;
                    this.autoclickTimeout = 0;
                    this.showCursor = true;
                }
            }
        }
    }
}

pc.registerScript(FirstPhaseManager);

FirstPhaseManager.attributes.add("uiButton", { type: "entity" });
FirstPhaseManager.attributes.add("truck", { type: "entity" });
FirstPhaseManager.attributes.add("ladle", { type: "entity" });
FirstPhaseManager.attributes.add("path", { type: "entity" });
FirstPhaseManager.attributes.add("helpCamera", { type: "entity" });
FirstPhaseManager.attributes.add("uiBanner", { type: "entity" });
FirstPhaseManager.attributes.add("textCounter", { type: "entity" });
FirstPhaseManager.attributes.add("worldButtonsArray", { type: "entity", array: true });
FirstPhaseManager.attributes.add("airplanePartsArray", { type: "entity", array: true });
