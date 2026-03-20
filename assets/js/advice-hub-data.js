export const ADVICE_SECTIONS = [
  {
    title: "Per iniziare",
    items: [
      {
        id: "install",
        title: "Installa l'app",
        text: "Installare Reactiondex come app rende l’esperienza più stabile e immediata: apertura più veloce, sensazione più pulita e accesso diretto dalla schermata principale del dispositivo. È il modo migliore per usare Reactiondex come uno strumento, non come una semplice pagina web."
      },
      {
        id: "first-search",
        title: "Inizia dalla ricerca",
        text: "Quando entri, non pensare subito ai filtri. Prova prima a cercare un nome, un mood o una situazione. Spesso è il modo più rapido per capire dove ti porta davvero il Reactiondex e per orientarti prima di restringere il campo."
      },
      {
        id: "use-float",
        title: "Usa il float di Lipu's Advice",
        text: "Il float di Lipu's Advice è una scorciatoia rapida per rileggere suggerimenti utili in qualsiasi momento. Non serve solo come decorazione: è pensato come un piccolo punto di orientamento dentro l’interfaccia."
      },
      {
        id: "hide-float",
        title: "Come nascondere il float",
        text: "Se il float ti distrae, puoi disattivarlo tenendo premuto l’avatar di Lipu per circa due secondi. Quando vorrai rivederlo, ti basterà tenere premuta una qualunque card reaction per qualche secondo e il float tornerà visibile."
      }
    ]
  },
  {
    title: "Ricerca",
    items: [
      {
        id: "finder",
        title: "Usa RX Finder",
        text: "RX Finder funziona meglio quando scrivi ciò che vuoi ottenere, non solo ciò che ricordi. Una descrizione semplice, un’atmosfera o un’intenzione spesso portano a risultati più utili del nome preciso, perché il sistema prova a leggere il senso della ricerca oltre la parola letterale."
      },
      
      {
  id: "emoji-search",
  title: "Prova a cercare con emoji",
  text: "A volte un’emoji dice più di una parola. Puoi usarla, all'interno del campo di ricerca di RX Finder, per cercare una reaction partendo da un’emozione o da un’atmosfera, senza dover scrivere una descrizione completa. È un modo più istintivo per arrivare al risultato giusto."
},
      
   {
  id: "keywords",
  title: "Prova keyword speciali",
  text: "Scrivi 'latest' per vedere le reaction più recenti in assoluto, oppure 'news' per scoprire solo quelle aggiunte dopo la tua ultima visita. È il modo più rapido per capire cosa è cambiato, senza usare filtri."
},
      
      
      
      ,
      {
        id: "broad-then-refine",
        title: "Cerca largo, poi rifinisci",
        text: "Quando non sei sicuro, parti ampio. Una ricerca troppo precisa rischia di nascondere alternative migliori. Prima esplora, poi usa i filtri per stringere il campo. In Reactiondex spesso la scoperta migliore arriva da una ricerca un po’ più aperta di quanto pensavi."
      },
      {
        id: "confidence-score",
        title: "Leggi il confidence score",
        text: "Il confidence score di RX Finder indica quanto il sistema considera coerente una reaction rispetto alla tua richiesta. Non va letto come verità assoluta, ma come misura di affinità: punteggi più alti suggeriscono una corrispondenza più forte, mentre valori più bassi possono ancora essere interessanti se stai esplorando in modo creativo."
      },
      {
        id: "semantic-vs-name",
        title: "Nome preciso o ricerca semantica?",
        text: "Se conosci già il nome della reaction, la ricerca diretta è il percorso più veloce. Se invece vuoi trovare qualcosa per tono, situazione o energia, RX Finder è spesso più adatto, perché prova a interpretare la richiesta invece di limitarsi al match letterale."
      }
    ]
  },
  {
    title: "Interfaccia",
    items: [
      {
        id: "top-picker",
        title: "A cosa serve il ticker in alto",
        text: "Il ticker che scorre in alto non serve solo a mostrare elementi: ti aiuta a leggere il ritmo dei risultati e a capire subito quante reaction stanno emergendo dalla ricerca corrente. È una fascia di orientamento rapida, utile per percepire il volume e l’identità dei match senza dover scorrere subito tutta la griglia."
      },
      
      {
        id: "float-origin",
        title: "Il float come accesso rapido",
        text: "Il float di Lipu non è solo un bottone: è pensato come un accesso flottante ai consigli, così da non occupare spazio fisso nella UI principale. Puoi spostarlo dove preferisci e trattarlo come un piccolo assistente laterale."
      }
    ]
  },
  {
    title: "RX Studio",
    items: [
      {
        id: "preset",
        title: "Salva preset",
        text: "Se trovi una combinazione di filtri che ha senso per te, salvala. Un buon preset riduce il rumore, velocizza il recupero e trasforma una ricerca ripetitiva in un gesto immediato. È particolarmente utile quando torni spesso sugli stessi tipi di reaction."
      },
      
      {
  id: "filter-description",
  title: "Non limitarti a selezionare",
  text: "Se tieni premuto su un filtro (origine, categoria, creator, generazione,status),puoi scoprire cosa rappresenta davvero. Capire un filtro spesso è più utile che usarne molti: ti aiuta a cercare meglio, non solo di più."
}
      ,
      {
  id: "origin-meaning",
  title: "Scegli l'origine con intenzione",
  text: "L'origine ti aiuta a distinguere il tipo di presenza visiva della reaction. Non è solo una differenza tecnica: cambia il modo in cui la scena viene percepita. Usarla bene significa scegliere prima il tipo di immagine, poi il contenuto."
},
      
      {
  id: "categories-meaning",
  title: "Usa le categorie con intenzione",
  text: "Le categorie non servono solo a filtrare, ma a orientare la ricerca. Ogni categoria rappresenta un tipo di energia o di scena: usarle bene significa scegliere prima il tono, poi la reaction."
},
      
      {
        id: "creator-mix",
        title: "Mescola creator",
        text: "Selezionare più creator non serve solo a restringere: serve a scoprire incastri. Alcune combinazioni hanno una personalità più interessante del singolo nome preso da solo, perché generano una sorta di tensione o equilibrio tra stili diversi."
      },
      
      
      {
  id: "creator-dominance",
  title: "Cos'è la dominanza di un creator",
  text: "La dominanza di un creator serve a capire in quale percentuale quel creator è presente nel Reactiondex. È una misura generale, utile per leggere il peso reale di un creator all’interno dell’archivio complessivo."
}
      
      ,
      {
        id: "use-status",
        title: "Leggi bene gli status",
        text: "Gli status non sono decorativi. Ti aiutano a capire il peso di una reaction nel Reactiondex: alcune sono di contesto, altre invece sono pensate per reggere da sole una scena. Imparare a leggerli rende più veloce scegliere la reaction giusta per l’intensità che stai cercando."
      },
      
      
      
      
      ,
      {
        id: "generation-logic",
        title: "Usa la generazione come bussola",
        text: "La generazione può aiutarti a leggere il Reactiondex nel tempo. Se vuoi un certo tono visivo o una certa epoca del progetto, partire da lì è spesso più utile di quanto sembri. È un filtro utile quando vuoi riconoscere una fase precisa dell’evoluzione di Reactiondex."
      }
    ]
  },
  {
    title: "Metriche e letture",
    items: [
      {
  
  id: "shineship",
  title: "Cos'è ShineShip",
  text: "ShineShip serve a visualizzare insieme due o più creator selezionati, escludendo gli altri. È utile quando vuoi isolare una combinazione precisa e vedere soltanto le reaction che rispettano davvero quella relazione tra creator, senza interferenze esterne. ShineShip è attivabile dentro RX Studio"

      },
      {
  id: "power-shineship",
  title: "Cos'è la Power ShineShip",
  text: "La Power ShineShip indica quanto spesso i creator selezionati compaiono insieme nelle stesse reaction. È una percentuale che misura la loro presenza combinata nel database: più è alta, più esistono reaction in cui quei creator sono presenti insieme, indipendentemente da eventuali altri creator nella stessa scena."
}
    
    
    
      ,
      {
  id: "shineship-heart",
  title: "Come leggere il cuore della ShineShip",
  text: "Il cuore della ShineShip è una rappresentazione visiva della Power ShineShip. Non aggiunge un nuovo valore: traduce semplicemente la percentuale in un livello immediato (bronzo, argento, oro)."
}
      
      
      ,
      
      
      {
        id: "metric-reading",
        title: "Non leggere le metriche da sole",
        text: "Score, percentuali e indicatori hanno senso solo insieme al contesto. Una metrica alta può aiutarti a orientarti, ma non sostituisce la qualità reale della reaction. Il consiglio giusto è usarle come bussola, non come giudizio definitivo."
      },
      {
        id: "when-score-matters",
        title: "Quando il punteggio conta davvero",
        text: "I punteggi contano soprattutto quando stai confrontando più risultati simili tra loro. In quei casi ti aiutano a capire quale match è più coerente. Se invece stai ancora esplorando, è più utile guardare il tono generale che il numero puro."
      }
    ]
  },
  {
    title: "Hotlist",
    items: [
      {
        id: "favorites",
        title: "Costruisci una Hotlist utile",
        text: "La Hotlist non dovrebbe contenere solo reaction belle: dovrebbe contenere reaction che usi davvero. Più è concreta, più diventa uno strumento e meno una semplice raccolta. Una buona Hotlist serve a recuperare velocemente il tuo gusto operativo."
      },
    
      {
        id: "rotate-hotlist",
        title: "Aggiornala spesso",
        text: "Una Hotlist troppo fissa perde valore. Se la aggiorni nel tempo, diventa uno specchio più fedele di ciò che stai cercando davvero adesso. Il valore della Hotlist sta anche nella sua capacità di cambiare con te."
      }
    ]
  },
  {
    title: "Metodo",
    items: [
      {
        id: "explore-before-save",
        title: "Esplora prima di decidere",
        text: "Una buona ricerca non serve solo a trovare subito la reaction giusta, ma anche a vedere possibilità che non avevi previsto. Decidere troppo presto a volte limita la qualità della scelta. Lasciati un margine di scoperta prima di fissare una decisione."
      },
      {
        id: "less-filters-more-intent",
        title: "Meno filtri, più intenzione",
        text: "Aggiungere molti filtri non significa cercare meglio. Spesso conviene partire da una direzione chiara e poi aumentare il controllo solo quando il risultato comincia davvero a prendere forma. La precisione utile arriva dopo l’intenzione, non prima."
      },
      {
        id: "trust-flow",
        title: "Usa il Reactiondex come flusso",
        text: "Il Reactiondex funziona meglio quando lo tratti come un sistema da attraversare, non solo da interrogare. Cerca, osserva, restringi, salva, confronta. Il valore dell’esperienza nasce proprio da questo movimento, non da un solo gesto isolato."
      }
    ]
  }
];
