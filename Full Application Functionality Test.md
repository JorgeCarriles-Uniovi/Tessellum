---
tags: ["feature", "hola"]
ta: "ast"
p: ""
a: ""
---
# Normal Markdown Text

normal text

bold -> **bold**

italic -> *italic*

striketrough -> ~~striketrough~~

# Lists

- one
- two
- three

1. one
2. two
3. three

> quote
> quote
> quote

# Headers

# hola
## hola
### hola
#### hola
##### hola
###### hola

# Links

[[Untitled (1)]] 

# Divider
---
# Code

```java
public class Person {
  
  int age;
  String name;
  
  public Person(int age, String name) {

    this.age = age;
    this.name = name;
    
  }

}
```

# Callouts

> [!success] Success
> success

> [!note] Note
> Note

# Terminal callout

> [!terminal]  Person.java
> public class Person {
>    int age;
>    String name;
> 
>    public Person(int age, String name) {
>       this.age = age;
>       this.name = name;
>    }
> }

> [!terminal] script.py
> # Outputting a message to the console
> print("Hello, World!")

>[!terminal] script.rs
>/// Synchronize the vault database with the filesystem.
>///
>/// This command should be called by the frontend after loading the vault path.
>/// It scans all .md files, indexes new/modified files, and removes deleted files.
>#[tauri::command]
>pub async fn sync_vault(
>    state: State<'_, AppState>,
>    vault_path: String,
>) -> Result<SyncResult, String> {
>    let db_guard = state.db.lock().await;
>
>    let db = db_guard.as_ref().ok_or("Database not initialized")?;
>
>    match VaultIndexer::full_sync(db, &vault_path).await {
>        Ok(stats) => {
>            let mut idx_guard = state.file_index.lock().await;
>            *idx_guard = None;
>            Ok(SyncResult::from(stats))
>        }
>        Err(e) => Ok(SyncResult {
>            success: false,
>            files_indexed: 0,
>            files_deleted: 0,
>            files_skipped: 0,
>            duration_ms: 0,
>            error: Some(e),
>        }),
>    }
>}

# Mermaid diagrams

```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```

```mermaid
graph TB
    subgraph "PERSISTENCIA GLOBAL"
        GI[GameInstance<br/>---<br/>- Progreso del jugador<br/>- Armas desbloqueadas<br/>- Habilidades adquiridas<br/>- Sistema de guardado]
    end

    subgraph "GESTIÓN DE NIVEL"
        GM[GameMode<br/>---<br/>- Reglas de combate<br/>- Sistema de spawn enemigos<br/>- Condiciones victoria/derrota<br/>- Gestión checkpoints]
        LB[LevelBlueprint<br/>---<br/>- Eventos específicos nivel<br/>- Cinemáticas<br/>- Activación plataformas<br/>- Spawn jefes]
    end

    subgraph "PERSONAJE JUGADOR"
        PC[PlayerController<br/>---<br/>- Input del jugador<br/>- Cambio entre menú/juego]
        CHAR[BP_PlayerCharacter<br/>---<br/>- Movimiento/salto<br/>- Animaciones<br/>- Estados: idle/run/jump/attack]
        COMBAT[ActorComponent<br/>CombatComponent<br/>---<br/>- Sistema de ataque<br/>- Equipar armas<br/>- Usar habilidades]
        STATS[ActorComponent<br/>StatsComponent<br/>---<br/>- Vida/stamina<br/>- Daño base<br/>- Defensa]
    end

    subgraph "ENEMIGOS"
        AIC[AIController<br/>---<br/>- Patrullaje<br/>- Persecución<br/>- Ataque]
        ENEMY[BP_EnemyBase<br/>---<br/>- Movimiento IA<br/>- Animaciones<br/>- Drop items]
        ENEMYCOMBAT[ActorComponent<br/>HealthComponent<br/>---<br/>- Sistema de vida<br/>- Recibir daño<br/>- Muerte]
    end

    subgraph "SISTEMAS DE JUEGO"
        WEP[BP_Weapon<br/>---<br/>- Estadísticas arma<br/>- Nivel mejora<br/>- Efectos especiales]
        ABILITY[BP_Ability<br/>---<br/>- Cooldown<br/>- Coste stamina<br/>- Efecto habilidad]
        PICKUP[BP_Pickup<br/>---<br/>- Materiales mejora<br/>- Consumibles<br/>- Coleccionables]
    end

    subgraph "INTERFAZ"
        HUD[Widget_HUD<br/>---<br/>- Barra vida/stamina<br/>- Arma equipada<br/>- Habilidades disponibles]
        MENU[Widget_MenuMejoras<br/>---<br/>- Árbol habilidades<br/>- Mejora armas<br/>- Inventario]
        PAUSE[Widget_PauseMenu<br/>---<br/>- Opciones<br/>- Guardar/Cargar<br/>- Salir]
    end

    subgraph "DATOS"
        DT_WEAPONS[DataTable<br/>Weapons<br/>---<br/>Estadísticas armas]
        DT_ABILITIES[DataTable<br/>Abilities<br/>---<br/>Info habilidades]
        DT_ENEMIES[DataTable<br/>Enemies<br/>---<br/>Stats enemigos]
        ENUM[Enumeration<br/>---<br/>- EstadoJugador<br/>- TipoArma<br/>- TipoEnemigo]
    end

    GI -.->|Persiste entre niveles| GM
    GM --> PC
    GM --> LB
    PC --> CHAR
    CHAR --> COMBAT
    CHAR --> STATS
    AIC --> ENEMY
    ENEMY --> ENEMYCOMBAT
    
    CHAR -.->|Usa| WEP
    CHAR -.->|Usa| ABILITY
    ENEMY -.->|Dropea| PICKUP
    
    CHAR --> HUD
    PC -.->|Abre/Cierra| MENU
    PC -.->|Abre/Cierra| PAUSE
    
    WEP -.->|Lee datos| DT_WEAPONS
    ABILITY -.->|Lee datos| DT_ABILITIES
    ENEMY -.->|Lee datos| DT_ENEMIES
    
    CHAR -.->|Usa| ENUM
    ENEMY -.->|Usa| ENUM

    style GI fill:#4a90e2
    style GM fill:#7b68ee
    style LB fill:#7b68ee
    style PC fill:#50c878
    style CHAR fill:#50c878
    style AIC fill:#e74c3c
    style ENEMY fill:#e74c3c
  
```

# Table
| Header 1 | Header 2 | Header 3 | Header 4 | Header 5 | Header 6 | Header 7 | Header 8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
|     |     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |     |
> [!info] Slash Command
> You can use the ''/'' key to open a menu that lets the user insert any markdown component supported by the application /


# LaTeX 

Full latex block

$$
\begin{bmatrix}
   \frac{1}{2} & \frac{3}{4} \\
   \int_0^1 x dx & \sum_{n=0}^\infty n
\end{bmatrix}
$$

Inline Latex block $3 + 2 = 5$ for inline math