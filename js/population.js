function arrayFilled(size, value) {
    return Array.apply(null, new Array(size)).map(Number.prototype.valueOf, value);
}
function matrix(size1, size2, value) {
    var x = new Array(size1);
    for (var i = 0; i < size1; i++) {
        x[i] = arrayFilled(size2, value);
    }
    return x;
}
function signe(number) {
    return number && number / Math.abs(number);
}
// return an int between 0 (inclusive) and max (exclusive)
function randomNextInt(max) {
    return Math.floor(randomNextDouble(max));
}

function randomNextDouble(max) {
    return Math.random() * max;
}

function Individual(parameters) {
    if (randomNextDouble() < parameters.egoInvolvedPart) {
        this.poids = [0.5, 0.9];
    } else {
        this.poids = [0.0, 0.0];
    }
    this.nSb = parameters.nbSubjBelief;
    this.mu = parameters.mu;
    this.sBavg = matrix(parameters.nbObjetsConnus, this.nSb, 0.0);
    this.sBavgInit = matrix(parameters.nbObjetsConnus, this.nSb, 0.0);
    this.sBunc = matrix(parameters.nbObjetsConnus, this.nSb, 0.0);
}

Individual.prototype.isExtremist = function () {
    return this.sBunc[0][0] === 0.0;
};
Individual.prototype.setExtremist = function (opinion) {
    this.sBavg[0][0] = opinion;
    this.sBunc[0][0] = 0.0;
    this.sBavg[0][1] = opinion;
    this.sBunc[0][1] = 0.0;
};
Individual.prototype.distance = function (indiv) {
    var distance = 0;
    for (var obj = 0; obj < this.nSb; obj++) {
        distance += Math.pow(this.sBavg[0][obj] - indiv.sBavg[0][obj], 2);
    }
    return Math.sqrt(distance);
};

function range(n) {
    return Array.apply(null, Array(n)).map(function (_, i) {
        return i;
    });
}


function Population(popSize, pe, egoInvolvedPart, mu, valBaseIncert, type) {
    this.parameters = {"nbReplicats": 1, "nbStep": 100000, "taille": popSize,
        "partExtremist": pe,
        "highlyEngaged": egoInvolvedPart,
        "scale": 3, "nbObjetsConnus": 1, "nbSubjBelief": 2,
        "mu": mu,
        "muDiv": [1.0, 1.0],
        "muPartDiv": [0.0, 0.0],
        // default type is 4
        "typeRencontre": 4, "posMuFort": 0.0, "typeInitBeliefAvg": "U",
        "valBaseIncert": valBaseIncert,
        "diviseursU0": 1.0, "diviseursU1": 1.0, "partCertains0": 0.0,
        "partCertains1": 0.0,
        "valBasem": [0.0, 0.0],
        "valBaseStd": [0.0, 0.0],
        "typeDiscus": 1,
        "typeRes": 5.0, "resM": 4.0, "delta": 1.0
    };
    this.iteration = 0;
    this.population = new Array(this.parameters.taille);
    // Initialisation de la population avec un mu sur une dimension et un
    // autre mu sur l'autre dimension
    for (var i = 0; i < this.parameters.taille; i++) {
        this.population[i] = new Individual(this.parameters);
    }
    // initialisation du mode de discussion et du réseau de voisinage
    for (var i = 0; i < this.parameters.taille; i++) {
        for (var z = 0; z < this.parameters.nbObjetsConnus; z++) {
            for (var j = 0; j < this.parameters.nbSubjBelief; j++) {
                this.population[i].sBavg[z][j] = randomNextDouble(2) - 1;
                //this.population[i].sBavgInit[z][j] = randomNextDouble(2) - 1;
                this.population[i].sBunc[z][j] = this.parameters.valBaseIncert[j];
            }
        }
        // initialization of extremist
        if (i < this.parameters.taille * this.parameters.partExtremist / 2) {
            // first side
            this.population[i].setExtremist(1.0);
        } else if (i < this.parameters.taille * this.parameters.partExtremist) {
            // second side
            this.population[i].setExtremist(-1.0);
        }
    }
    this.nbRejet = 0;
    this.nbAttraction = 0;
    this.distRejet = 0.0;
    this.distAttraction = 0.0;
    this.distRejetConfine = 0.0;
    this.distAttractionConfine = 0.0;
}

Population.prototype.getClusters = function (epsilon) {
    // gathering index of moderate individuals
    var self = this;
    var todo = range(this.parameters.taille).filter(function (indIndex) {
        return !self.population[indIndex].isExtremist();
    });
    var clusters = [];
    while (todo.length > 0) {
        var currentCluster = [this.population[todo.pop()]];
        range(todo.length).filter(function (indIndex) {
            return currentCluster[0].distance(self.population[todo[indIndex]]) < epsilon;
        }).forEach(function (indIndex) {
            currentCluster.push(self.population[todo.splice(indIndex, 1)[0]]);
        });
        clusters.push(currentCluster);
    }
    return clusters;
};

/**
 * Returns the polarized opinions average.
 */
Population.prototype.getOpAvg = function (subj) {
    return this.population.reduce((prev, cur) => prev + Math.abs(cur.sBavg[0][subj]), 0) / this.population.length;
};

Population.prototype.iter = function (iteration) {
// Type de rencontre typ = 1 (BC Simple), 2 (Relative Agreement), 
// 0 modèle PBC de Jean-Denis Mathias
// 3 (AR avec rejet non hiérarchisé possible sur toutes les dimensions), 
// 4 (AR rejet sur seule dimension secondaire dynamique piloté par main dimension sur dimensions hiérarchisée)

    var type = this.parameters.typeRencontre;
    var temp = range(this.parameters.taille);
    // shuffling
    for (var j, x, i = temp.length; i; j = Math.floor(Math.random() * i), x = temp[--i], temp[i] = temp[j], temp[j] = x)
        ;
    var nbCouples = this.parameters.taille / 2;
    for (var posI = 0; posI < nbCouples; posI++) {
        var i = temp[posI];
        var j = temp[this.parameters.taille - 1 - posI];
        var mouvIndivJ = arrayFilled(this.parameters.nbSubjBelief, 0);
        var mouvIndivI = arrayFilled(this.parameters.nbSubjBelief, 0);
        var mouvIncertJ = arrayFilled(this.parameters.nbSubjBelief, 0);
        var mouvIncertI = arrayFilled(this.parameters.nbSubjBelief, 0);
        switch (type) {
            case 0:
                mouvIndivJ = this.discussionMouvPBC2D(this.population[i], this.population[j], 0); //BC de JDM
                mouvIndivI = this.discussionMouvPBC2D(this.population[j], this.population[i], 0); //BC de JDM
                break;
            case 1:
                mouvIndivJ = this.discussionMouvBC2DSimple(this.population[i], this.population[j], 0); //BC
                mouvIndivI = this.discussionMouvBC2DSimple(this.population[j], this.population[i], 0); //BC
                break;
            case 2:
                var result = this.discussionMouvRelativAgreement(this.population[i], this.population[j], 0); //relative agreement Deffuant et al JASSS 2002
                mouvIndivJ = result[0];
                mouvIncertJ = result[1];
                var result = this.discussionMouvRelativAgreement(this.population[j], this.population[i], 0); //relative agreement Deffuant et al JASSS 2002
                mouvIndivI = result[0];
                mouvIncertI = result[1];
                break;
            case 3:
                var result = this.discussionMouvARNonHierarchise(this.population[i], this.population[j], 0); //AR théories
                mouvIndivJ = result[0];
                mouvIncertJ = result[1];
                var result = this.discussionMouvARNonHierarchise(this.population[j], this.population[i], 0); //AR théories
                mouvIndivI = result[0];
                mouvIncertI = result[1];
                break;
            case 4:
                mouvIndivJ = this.discussionMouvARHierarchise(this.population[i], this.population[j], 0); //ARWood
                mouvIndivI = this.discussionMouvARHierarchise(this.population[j], this.population[i], 0); //ARWood
                break;
        }
        if (mouvIndivJ[0] !== 0.0) {
            this.population[j].sBavg[0][0] = this.population[j].sBavg[0][0] + mouvIndivJ[0];
            if (type === 2 || type === 5 || type === 6 || type === 3) {
                this.population[j].sBunc[0][0] = this.population[j].sBunc[0][0] + mouvIncertJ[0];
            }
        }
        if (mouvIndivJ[1] !== 0.0) {
            this.population[j].sBavg[0][1] = this.population[j].sBavg[0][1] + mouvIndivJ[1];
            if (type === 2 || type === 5 || type === 6 || type === 3) {
                this.population[j].sBunc[0][1] = this.population[j].sBunc[0][1] + mouvIncertJ[1];
            }
        }
        if (mouvIndivI[0] !== 0.0) {
            this.population[i].sBavg[0][0] = this.population[i].sBavg[0][0] + mouvIndivI[0];
            if (type === 2 || type === 5 || type === 6 || type === 3) {
                this.population[i].sBunc[0][0] = this.population[i].sBunc[0][0] + mouvIncertI[0];
            }
        }
        if (mouvIndivI[1] !== 0.0) {
            this.population[i].sBavg[0][1] = this.population[i].sBavg[0][1] + mouvIndivI[1];
            if (type === 2 || type === 5 || type === 6 || type === 3) {
                this.population[i].sBunc[0][1] = this.population[i].sBunc[0][1] + mouvIncertI[1];
            }
        }
//* Confinement et maintien de u entre 0 et 1
        for (var m = 0; m < this.parameters.nbSubjBelief; m++) {
// Confinement
            if (this.population[i].sBavg[0][m] > (this.parameters.scale - 1) / 2) {
                this.population[i].sBavg[0][m] = ((this.parameters.scale - 1) / 2);
            } else if (this.population[i].sBavg[0][m] < -((this.parameters.scale - 1) / 2)) {
                this.population[i].sBavg[0][m] = -((this.parameters.scale - 1) / 2);
            }
// Maintien de u entre 0 et 2
            if (this.population[i].sBunc[0][m] > 2.0) {
                this.population[i].sBunc[0][m] = 2.0;
            }
            if (this.population[i].sBunc[0][m] < 0.0) {
                this.population[i].sBunc[0][m] = 0.0;
            }
        }
        for (var m = 0; m < this.parameters.nbSubjBelief; m++) {
// Confinement et maintien de u entre 0 et 1
            if (this.population[j].sBavg[0][m] > (this.parameters.scale - 1) / 2) {
                this.population[j].sBavg[0][m] = ((this.parameters.scale - 1) / 2);
            } else if (this.population[j].sBavg[0][m] < -((this.parameters.scale - 1) / 2)) {
                this.population[j].sBavg[0][m] = -((this.parameters.scale - 1) / 2);
            }
// Maintien de u entre 0 et 1
            if (this.population[j].sBunc[0][m] > 2.0) {
                this.population[j].sBunc[0][m] = 2.0;
            }
            if (this.population[j].sBunc[0][m] < 0.0) {
                this.population[j].sBunc[0][m] = 0.0;
            }
        }
    }
};
/**
 * BC 2D le plus simple Méthode de discussion et d'influence entre les
 * objets dont les valeurs de subjective belief sont proches pour une
 * rencontre entre deux individus, influence directionnelle a influence b -
 * bounded confidence model en 2D présenté pour ma soutenance (janvier 2013)
 * avec accord si proche sur 2 dimensions, indifférence dans toutes les
 * autres situations, y compris sur proche sur une seule dimension
 */
Population.prototype.discussionMouvBC2DSimple = function (a, b, objet) {
    var mouvAvgDim = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    // Interaction mode: 1 means increase closeness; -1 means rejection (increase farness)
    var dist = arrayFilled(this.parameters.nbSubjBelief, 0);
    var distInter = arrayFilled(this.parameters.nbSubjBelief, 0); // distance réel inter individus
    for (var i = 0; i < this.parameters.nbSubjBelief; i++) {
        distInter[i] = Math.abs(a.sBavg[objet][i] - b.sBavg[objet][i]);
        dist[i] = -(distInter[i] - b.sBunc[objet][i]);
        // if distance is negative, no common opinion part
        // if distance is positive, then there is a common opinion part
    }
    if (dist[0] > 0.0 && dist[1] > 0.0) {
        // then attraction on both dimensions
        for (i = 0; i < this.parameters.nbSubjBelief; i++) {
            mouvAvgDim[i] = this.onlyAttraction(a, b, dist[i], objet, i, distInter[i]); // attraction seule possible
        }
    }
    return mouvAvgDim;
};
/**
 * Méthode de calcul de l'influence (modèle BC) lorsque les individus
 * n'échangent que sur une seule dimension
 */
Population.prototype.onlyAttraction = function (a, b, dist, objet, att, distInter) {
    // we compute the move of the Individu b
    var influe = 0.0;
    var mouvAvg = 0.0;
    var persuasion = a.mu[att] / (a.mu[att] + b.mu[att]); // computation of mu
    // Fonction d'influence bounded confidence model (Deffuant 2002)
    if (distInter < b.sBunc[objet][att]) {
        influe = 1.0 * persuasion;
    }
    mouvAvg = influe * (a.sBavg[objet][att] - b.sBavg[objet][att]);
    return mouvAvg;
};
Population.prototype.discussionMouvPBC2D = function (a, b, objet) {
    // the individual who changes her opinion is the second: individu b
    var mouvAvgDim = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    // Interaction mode: 1 means increase closeness; -1 means rejection (increase farness)
    var dist = arrayFilled(this.parameters.nbSubjBelief, 0);
    var distInter = arrayFilled(this.parameters.nbSubjBelief, 0); // distance réel inter individus
    // ONLY 1 D
    for (var i = 0; i < 1; i++) {
        distInter[i] = Math.abs(a.sBavg[objet][i] - b.sBavg[objet][i]);
        dist[i] = -(distInter[i] - b.sBunc[objet][i]);
        // if distance is negative, no common opinion part
        // if distance is positive, then there is a common opinion part
    }
    // then attraction if close on one dim
    for (var i = 0; i < 1; i++) {
        mouvAvgDim[i] = this.onlyAttraction(a, b, dist[i], objet, i, distInter[i]); // attraction seule possible
    }
    return mouvAvgDim;
};
Population.prototype.onlyAttraction = function (a, b, dist, objet, att, distInter) {
    // we compute the move of the Individu b
    var persuasion = a.mu[att] / (a.mu[att] + b.mu[att]); // computation of mu
    var influe = this.influenceBC(a, b, objet, att, distInter) * persuasion;
    return influe * (a.sBavg[objet][att] - b.sBavg[objet][att]);
};
Population.prototype.attractionWithoutConditionMouv = function (a, b, objet, att) {
    return b.mu[att] * (a.sBavg[objet][att] - b.sBavg[objet][att]);
};
Population.prototype.influenceBC = function (a, b, objet, belief, dist) {
    if (dist < b.sBunc[objet][belief]) {
        return 1.0;
    } else {
        return 0.0;
    }
};
Population.prototype.influenceAvg = function (a, b, objet, belief) {
    var inf = 0.0;
    var dif = a.sBavg[objet][belief] - b.sBavg[objet][belief];
    var sign = 1;
    if (dif === 0.0) {
        if (Math.random() < 0.5) {
            sign = -1;
        } // choix aleatoire quand les op des deux individus sont égales
    } else {
        sign = signe(dif);
    }
    var dist = Math.abs(a.sBavg[objet][belief] - b.sBavg[objet][belief]);
    inf = sign * (b.sBunc[objet][belief] - dist);
    return inf;
};
/**
 * Method computing the mouvement of opinion during a discussion between a
 * and b based on Wood et al 1996
 */
Population.prototype.discussionMouvARHierarchise = function (a, b, objet) {
    var mouvAvgDim = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    // self relevance of positive dimension (smaller it is more relevant it is)
    var selfRelevancePos = 0.0;
    // self relevance of negative dimension
    var selfRelevanceNeg = 0.0;
    var dist = arrayFilled(this.parameters.nbSubjBelief, 0);
    for (var i = 0; i < this.parameters.nbSubjBelief; i++) {
        dist[i] = -(Math.abs(a.sBavg[objet][i] - b.sBavg[objet][i]) - b.sBunc[objet][i]);
        // if distance is negative, no common opinion part
        // if distance is positive, then there is a common opinion part
    }
    // The main dimension is defined by poids[i]
    for (var i = 0; i < this.parameters.nbSubjBelief; i++) {
        if (dist[i] >= 0) {
            selfRelevancePos = selfRelevancePos + 1 / b.poids[i];
        } else {
            selfRelevanceNeg = selfRelevanceNeg + 1 / b.poids[i];
        }
    } // ou est si loin loin alors rien
    if (selfRelevancePos === selfRelevanceNeg) { // nothing is more important than other
        mouvAvgDim = this.discussionMouvBC2DSimple(a, b, objet);
    } else if (selfRelevancePos > selfRelevanceNeg) { // The individual defines itself positively in regards to A
        // Attraction on every dimensions
        for (i = 0; i < this.parameters.nbSubjBelief; i++) {
            mouvAvgDim[i] = this.attractionWithoutConditionMouv(a, b, objet, i);
        }
    } else { // The individual defines itself positively in regards to B
        // Rejection on every dimension of closeness (< U)
        for (i = 0; i < this.parameters.nbSubjBelief; i++) {
            if (dist[i] >= 0) { // rejection on closeness dimension if same sign as me
                mouvAvgDim[i] = -b.mu[i] * this.influenceAvg(a, b, objet, i);
            }
        }
    }
    return mouvAvgDim;
};
/**
 * RelativeAgreement model (2002) Méthode de discussion et d'influence entre
 * les objets dont les valeurs de subjective belief sont proches pour une
 * rencontre entre deux individus, influence directionnelle a influence b -
 * bounded confidence model en 2D présenté pour ma soutenance (janvier 2013)
 * avec accord si proche sur 2 dimensions, indifférence dans toutes les
 * autres situations, y compris sur proche sur une seule dimension
 */
Population.prototype.discussionMouvRelativAgreement = function (a, b, objet) {
    var mouvAvgDim = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    var mouvUncDim = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    // Interaction mode: 1 means increase closeness; -1 means rejection (increase farness)
    var distInter = arrayFilled(this.parameters.nbSubjBelief, 0.0); // distance réel inter individus
    for (var i = 0; i < this.parameters.nbSubjBelief; i++) {
        distInter[i] = Math.min((a.sBavg[objet][i] + a.sBunc[objet][i]), (b.sBavg[objet][i] + b.sBunc[objet][i]))
                - Math.max((a.sBavg[objet][i] - a.sBunc[objet][i]), (b.sBavg[objet][i] - b.sBunc[objet][i])); // calcul de hij (overlap) - voir Deffuant, Amblard, Weisbuch, Faure, JASSS 2002
    }
    if (distInter[0] > a.sBunc[objet][0]) {
        // then attraction on both dimensions
        mouvAvgDim[0] = (b.mu[0] * ((distInter[0] / a.sBunc[objet][0]) - 1) * (a.sBavg[objet][0] - b.sBavg[objet][0]));
        if (Math.abs(a.sBunc[objet][0] - b.sBunc[objet][0]) === 0.0) {
            mouvUncDim[0] = (b.mu[0] * ((distInter[0] / a.sBunc[objet][0]) - 1) * (-Math.random() / 100.0));
        } else {
            mouvUncDim[0] = (b.mu[0] * ((distInter[0] / a.sBunc[objet][0]) - 1) * (a.sBunc[objet][0] - b.sBunc[objet][0]));
        }
    }
    if (distInter[1] > a.sBunc[objet][1]) {
        // then attraction on both dimensions
        mouvAvgDim[1] = (b.mu[1] * ((distInter[1] / a.sBunc[objet][1]) - 1) * (a.sBavg[objet][1] - b.sBavg[objet][1]));
        if (Math.abs(a.sBunc[objet][1] - b.sBunc[objet][1]) === 0.0) {
            mouvUncDim[1] = (b.mu[1] * ((distInter[1] / a.sBunc[objet][1]) - 1) * (-Math.random() / 100.0));
        } else {
            mouvUncDim[1] = (b.mu[1] * ((distInter[1] / a.sBunc[objet][1]) - 1) * (a.sBunc[objet][1] - b.sBunc[objet][1]));
        }
    }
    return [mouvAvgDim, mouvUncDim];
};
/**
 * Méthode de discussion et d'influence entre les objets dont les valeurs de
 * subjective belief sont proches pour une rencontre entre deux individus,
 * influence directionnelle a influence b Méthode Huet et Deffuant 2007
 * Théorie du Jugement Social (attirance ou rejet de l'autre) ACS Paper
 * March 2008
 */
Population.prototype.discussionMouvARNonHierarchise = function (a, b, objet) {
    var mouvAvgDim = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    var mouvUncDim = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    // Interaction mode: 1 means increase closeness; -1 means rejection (increase farness)
    var dist = arrayFilled(this.parameters.nbSubjBelief, 0.0);
    var distInter = arrayFilled(this.parameters.nbSubjBelief, 0.0); // distance réel inter individus
    for (var i = 0; i < this.parameters.nbSubjBelief; i++) {
        distInter[i] = Math.abs(a.sBavg[objet][i] - b.sBavg[objet][i]);
        dist[i] = -(distInter[i] - b.sBunc[objet][i]);
    }
    var modeInteract = (dist[1] * dist[0] > 0.0);
    for (var i = 0; i < this.parameters.nbSubjBelief; i++) {
        if (modeInteract) { // rapprochement
            mouvAvgDim[i] = this.onlyAttraction(a, b, dist[i], objet, i, distInter[i]); // attraction seule possible
        } else { // rejet, éloignement
            var baseRejet = 0;
            if (i === 0) {
                baseRejet = 1;
            }
            if (dist[i] > 0) {
                if ((this.parameters.delta * b.sBunc[objet][baseRejet]) < -dist[baseRejet]) {
                    // if far enough then rejection
                    mouvAvgDim[i] = -b.mu[i] * this.influenceAvg(a, b, objet, i, distInter[i]);
                } else { // else increase closeness
                    var influe = this.influenceBC(a, b, objet, i, distInter[i]);
                    mouvAvgDim[i] = a.mu[i] * influe * (a.sBavg[objet][i] - b.sBavg[objet][i]);
                }
            }
        }
    }
    return [mouvAvgDim, mouvUncDim];
};
